import { BOT_DEFINITIONS, type BotDefinition } from "./data/bots.js";
import { maxLengthOption, optionsObject, uaInput } from "./input.js";
import type { BotResult } from "./types.js";

/** Options for {@link detectBot}. */
export interface DetectBotOptions {
  /** Inputs longer than this are cut first (default 2048). */
  maxLength?: number | undefined;
}

const NOT_A_BOT: BotResult = Object.freeze({
  isBot: false,
  category: undefined,
  name: undefined,
  version: undefined,
  operator: undefined,
  url: undefined,
  respectsRobotsTxt: undefined,
  verification: undefined,
  generic: false,
}) as BotResult;

// Generic heuristics for agents that are not in the table. A word ending in
// bot / crawler / spider (but not the phone brand "Cubot"), or a URL in the UA.
export const GENERIC_WORD = /(?:^|[^A-Za-z0-9._-])([A-Za-z0-9._-]{0,40}?(?:bot|crawler|spider|scraper))(?![A-Za-z])/i;
export const GENERIC_URL = /\bhttps?:\/\/|\(\+?www\.|\+http/i;
const NOT_BOT_WORDS = new Set(["cubot"]);

function fromDefinition(d: BotDefinition, match: RegExpExecArray): BotResult {
  // Baiduspider product variants: report the variant that matched.
  const named = d.id === "baiduspider" ? match[1] : undefined;
  const version = d.id === "baiduspider" ? match[2] : match[1];
  return {
    isBot: true,
    category: d.category,
    name: named ?? d.name,
    version,
    operator: d.operator,
    url: d.url,
    respectsRobotsTxt: d.respectsRobotsTxt,
    verification: d.verification,
    generic: false,
  };
}

/** @internal Detection on an already capped string. */
export function detectBotIn(ua: string): BotResult {
  if (ua === "") return { ...NOT_A_BOT };
  const lower = ua.toLowerCase();
  for (const d of BOT_DEFINITIONS) {
    if (!lower.includes(d.token)) continue;
    const m = d.pattern.exec(ua);
    if (m !== null) return fromDefinition(d, m);
  }
  const word = GENERIC_WORD.exec(ua);
  const name = word?.[1];
  if (name !== undefined && !NOT_BOT_WORDS.has(name.toLowerCase())) {
    return { ...NOT_A_BOT, isBot: true, category: "other", name, generic: true };
  }
  if (GENERIC_URL.test(ua)) return { ...NOT_A_BOT, isBot: true, category: "other", generic: true };
  return { ...NOT_A_BOT };
}

/**
 * Identifies crawlers, AI agents, HTTP libraries and other automated clients
 * from a User-Agent string. Matching is purely lexical: a UA is trivially
 * spoofed, so use {@link verifyBotHints} / {@link verifyBotDns} before trusting it.
 */
export function detectBot(ua: string | null | undefined, options?: DetectBotOptions): BotResult {
  const opts = optionsObject<DetectBotOptions>(options, "detectBot");
  return detectBotIn(uaInput(ua, maxLengthOption(opts.maxLength), "detectBot").ua);
}

/** True when {@link detectBot} recognises the UA as automated (including the generic heuristic). */
export function isBot(ua: string | null | undefined, options?: DetectBotOptions): boolean {
  return detectBot(ua, options).isBot;
}

/** True for AI crawlers, AI assistants (user-triggered fetchers) and AI search crawlers. */
export function isAiBot(ua: string | null | undefined, options?: DetectBotOptions): boolean {
  const c = detectBot(ua, options).category;
  return c === "ai-crawler" || c === "ai-assistant" || c === "ai-search";
}
