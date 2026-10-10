// Bot verification helpers. No network access happens here: DNS lookups are
// done by resolver functions the caller injects (e.g. node:dns/promises).
import { detectBotIn } from "./bots.js";
import { verifyBotHints, type BotVerificationHint } from "./data/verification.js";
import { fail, show } from "./errors.js";
import { DEFAULT_MAX_LENGTH } from "./input.js";
import type { BotResult } from "./types.js";

// ------------------------------------------------------------------ IP parsing
/** Parses an IPv4 / IPv6 address into 4 or 16 bytes, or undefined. */
function parseIp(input: string): Uint8Array | undefined {
  const s = input.trim();
  if (s.length > 64) return undefined;
  if (s.includes(":")) return parseIPv6(s.replace(/%[0-9A-Za-z._~-]{1,32}$/, "")); // drop zone id
  return parseIPv4(s);
}

function parseIPv4(s: string): Uint8Array | undefined {
  const parts = s.split(".");
  if (parts.length !== 4) return undefined;
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    const p = parts[i] as string;
    if (!/^(?:0|[1-9]\d{0,2})$/.test(p)) return undefined;
    const n = Number(p);
    if (n > 255) return undefined;
    out[i] = n;
  }
  return out;
}

function parseIPv6(s: string): Uint8Array | undefined {
  let head = s;
  let tail = "";
  const dbl = s.indexOf("::");
  if (dbl >= 0) {
    if (s.indexOf("::", dbl + 1) >= 0) return undefined;
    head = s.slice(0, dbl);
    tail = s.slice(dbl + 2);
  }
  const groups = (part: string): number[] | undefined => {
    if (part === "") return [];
    const out: number[] = [];
    const items = part.split(":");
    for (let i = 0; i < items.length; i++) {
      const g = items[i] as string;
      if (i === items.length - 1 && g.includes(".")) {
        const v4 = parseIPv4(g);
        if (v4 === undefined) return undefined;
        out.push(((v4[0] as number) << 8) | (v4[1] as number), ((v4[2] as number) << 8) | (v4[3] as number));
        continue;
      }
      if (!/^[0-9A-Fa-f]{1,4}$/.test(g)) return undefined;
      out.push(parseInt(g, 16));
    }
    return out;
  };
  const h = groups(head);
  const t = groups(tail);
  if (h === undefined || t === undefined) return undefined;
  if (head.includes(".") && dbl >= 0) return undefined; // embedded IPv4 only at the very end
  const missing = 8 - h.length - t.length;
  if (dbl >= 0 ? missing < 1 : missing !== 0) return undefined;
  const all = [...h, ...new Array<number>(dbl >= 0 ? missing : 0).fill(0), ...t];
  const out = new Uint8Array(16);
  all.forEach((g, i) => {
    out[i * 2] = g >> 8;
    out[i * 2 + 1] = g & 0xff;
  });
  return out;
}

/** IPv4-mapped IPv6 (::ffff:a.b.c.d) → IPv4 bytes. */
function unmap(b: Uint8Array): Uint8Array {
  if (b.length === 16 && b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff) return b.slice(12);
  return b;
}

function sameIp(a: string, b: string): boolean {
  const x = parseIp(a);
  const y = parseIp(b);
  if (x === undefined || y === undefined) return false;
  const ux = unmap(x);
  const uy = unmap(y);
  return ux.length === uy.length && ux.every((v, i) => v === uy[i]);
}

/**
 * True when `ip` is inside any of the CIDR blocks (IPv4 or IPv6; a bare address
 * counts as a /32 or /128). IPv4-mapped IPv6 addresses match IPv4 blocks.
 * Malformed IPs or blocks never match.
 */
export function ipInCidrs(ip: string, cidrs: readonly string[]): boolean {
  if (typeof ip !== "string") fail("InvalidInput", `ipInCidrs: ip must be a string, got ${show(ip)}`);
  if (!Array.isArray(cidrs)) fail("InvalidInput", `ipInCidrs: cidrs must be an array, got ${show(cidrs)}`);
  const parsed = parseIp(ip);
  if (parsed === undefined) return false;
  const addr = unmap(parsed);
  for (const cidr of cidrs) {
    if (typeof cidr !== "string") continue;
    const [base, bitsText, extra] = cidr.trim().split("/");
    if (base === undefined || extra !== undefined) continue;
    const net = parseIp(base);
    if (net === undefined) continue;
    const netAddr = unmap(net);
    const max = net.length * 8;
    let bits = max;
    if (bitsText !== undefined) {
      if (!/^\d{1,3}$/.test(bitsText)) continue;
      bits = Number(bitsText);
      if (bits > max) continue;
    }
    // A mapped network ::ffff:a.b.c.d/n covers IPv4 /(n-96).
    if (netAddr.length !== net.length) bits -= 96;
    if (bits < 0 || netAddr.length !== addr.length) continue;
    let ok = true;
    for (let i = 0; i < netAddr.length && ok; i++) {
      const take = Math.max(0, Math.min(8, bits - i * 8));
      if (take === 0) break;
      const mask = (0xff << (8 - take)) & 0xff;
      ok = ((addr[i] as number) & mask) === ((netAddr[i] as number) & mask);
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Extracts CIDR blocks from a published IP-range document in the common
 * `{"prefixes":[{"ipv4Prefix":"…"},{"ipv6Prefix":"…"}]}` layout (Google, Bing,
 * OpenAI, Perplexity, Apple, Common Crawl, DuckDuckGo, Mistral, Seznam, Ahrefs,
 * Discord). Pass the parsed JSON; unknown shapes yield an empty array.
 */
export function cidrsFromIpRanges(json: unknown): string[] {
  if (typeof json !== "object" || json === null) return [];
  const prefixes = (json as { prefixes?: unknown }).prefixes;
  if (!Array.isArray(prefixes)) return [];
  const out: string[] = [];
  for (const p of prefixes as unknown[]) {
    if (typeof p !== "object" || p === null) continue;
    const { ipv4Prefix, ipv6Prefix } = p as { ipv4Prefix?: unknown; ipv6Prefix?: unknown };
    if (typeof ipv4Prefix === "string") out.push(ipv4Prefix);
    if (typeof ipv6Prefix === "string") out.push(ipv6Prefix);
  }
  return out;
}

// ------------------------------------------------------------------ hints lookup
/**
 * The documented verification method for a UA (or a {@link BotResult} from
 * {@link detectBot}); undefined when the bot is unknown or its operator
 * documents none.
 */
export function getVerificationHint(uaOrBot: string | BotResult): BotVerificationHint | undefined {
  const bot = typeof uaOrBot === "string" ? detectBotIn(uaOrBot.slice(0, DEFAULT_MAX_LENGTH)) : uaOrBot;
  const key = bot?.verification;
  if (typeof key !== "string" || !Object.prototype.hasOwnProperty.call(verifyBotHints, key)) return undefined;
  return verifyBotHints[key];
}

// ------------------------------------------------------------------ DNS verification
/** Injected resolvers; both may reject or return an empty list. */
export interface DnsResolvers {
  /** Reverse (PTR) lookup: IP → host names. */
  reverse: (ip: string) => Promise<readonly string[]>;
  /** Forward lookup: host name → IP addresses (A and/or AAAA). */
  forward: (hostname: string) => Promise<readonly string[]>;
}

export interface DnsVerification {
  verified: boolean;
  /** The host name that passed forward confirmation. */
  hostname: string | undefined;
  /** Why verification failed (or `ok`). */
  reason: "ok" | "unknown-bot" | "no-dns-method" | "invalid-ip" | "no-ptr" | "domain-mismatch" | "forward-mismatch" | "lookup-failed";
  hint: BotVerificationHint | undefined;
}

/** True when `host` is `suffix` or ends with `.suffix` (case-insensitive, trailing dot ignored). */
const LABEL = /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/;

/** Lowercase host without the trailing dot, or undefined when it is not a valid DNS name. */
function cleanHost(host: string): string | undefined {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (h.length === 0 || h.length > 253) return undefined;
  return h.split(".").every((label) => LABEL.test(label)) ? h : undefined;
}

function hostMatches(host: string, suffix: string): boolean {
  const h = cleanHost(host);
  if (h === undefined) return false;
  const s = suffix.toLowerCase();
  return h === s || h.endsWith(`.${s}`);
}

/**
 * Forward-confirmed reverse DNS check for operators that document it (Google,
 * Bing, Apple, Yandex, Baidu, Seznam, Ahrefs, Pinterest, Common Crawl, You.com):
 * PTR(ip) must end with an official domain and that host must resolve back to
 * `ip`. `bot` is a UA string, a {@link BotResult}, or a `verifyBotHints` key.
 * Resolvers are injected, so this module never touches the network itself.
 */
export async function verifyBotDns(ip: string, bot: string | BotResult, resolvers: DnsResolvers): Promise<DnsVerification> {
  if (typeof ip !== "string") fail("InvalidInput", `verifyBotDns: ip must be a string, got ${show(ip)}`);
  if (
    typeof resolvers !== "object" ||
    resolvers === null ||
    typeof resolvers.reverse !== "function" ||
    typeof resolvers.forward !== "function"
  ) {
    fail("InvalidOption", "verifyBotDns: resolvers must provide reverse(ip) and forward(hostname) functions");
  }
  const hint =
    typeof bot === "string" && Object.prototype.hasOwnProperty.call(verifyBotHints, bot) ? verifyBotHints[bot] : getVerificationHint(bot);
  if (hint === undefined) return { verified: false, hostname: undefined, reason: "unknown-bot", hint };
  if (hint.reverseDnsSuffixes.length === 0) return { verified: false, hostname: undefined, reason: "no-dns-method", hint };
  if (parseIp(ip) === undefined) return { verified: false, hostname: undefined, reason: "invalid-ip", hint };
  let names: readonly string[];
  try {
    names = await resolvers.reverse(ip.trim());
  } catch {
    return { verified: false, hostname: undefined, reason: "lookup-failed", hint };
  }
  if (!Array.isArray(names) || names.length === 0) return { verified: false, hostname: undefined, reason: "no-ptr", hint };
  const candidates = names.filter((n): n is string => typeof n === "string" && hint.reverseDnsSuffixes.some((s) => hostMatches(n, s)));
  if (candidates.length === 0) return { verified: false, hostname: undefined, reason: "domain-mismatch", hint };
  let failed = false;
  for (const host of candidates.slice(0, 5)) {
    let addrs: readonly string[];
    try {
      addrs = await resolvers.forward(host);
    } catch {
      failed = true;
      continue;
    }
    if (Array.isArray(addrs) && addrs.some((a) => typeof a === "string" && sameIp(a, ip))) {
      return { verified: true, hostname: cleanHost(host), reason: "ok", hint };
    }
  }
  return { verified: false, hostname: undefined, reason: failed ? "lookup-failed" : "forward-mismatch", hint };
}
