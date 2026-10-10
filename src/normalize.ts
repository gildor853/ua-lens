import { parse } from "./parse.js";
import type { DeviceType, ParseOptions, ParseResult } from "./types.js";

/** Compact, stable summary of a {@link ParseResult}. */
export interface NormalizedUa {
  /** Human-readable, e.g. `Chrome 129 / Windows 10+ / desktop` or `GPTBot 1.4 / bot (ai-crawler)`. */
  label: string;
  /** Stable machine id, e.g. `chrome-129:windows-10+:desktop`; suitable as a metrics / cache key. */
  id: string;
  /** Slug of the browser (or bot) name, `unknown` when not identified. */
  browser: string;
  browserMajor: number | undefined;
  /** Slug of the OS name, `unknown` when not identified. */
  os: string;
  /** Coarse OS version: major version (`14`, `18`), Windows marketing name (`11`, `10+`, `7`). */
  osVersion: string | undefined;
  device: DeviceType;
  /** Slug of the bot name when the UA is a known bot. */
  bot: string | undefined;
}

function slug(s: string): string {
  const dashed = s.toLowerCase().replace(/[^a-z0-9.+]/g, "-");
  let out = "";
  for (const part of dashed.split("-")) if (part !== "") out += (out === "" ? "" : "-") + part;
  return out;
}

/** @internal Coarse OS version used by labels. */
export function coarseOsVersion(r: ParseResult): string | undefined {
  const { os } = r;
  if (os.name === "Windows") {
    if (os.version !== undefined) return os.version;
    return os.reportedVersion === "10.0" ? "10+" : undefined;
  }
  if (os.version === undefined) return undefined;
  const m = /^\d{1,6}/.exec(os.version);
  return m === null ? os.version : m[0];
}

/** Builds the {@link NormalizedUa} for an existing parse result. */
export function normalizeResult(r: ParseResult): NormalizedUa {
  const osVersion = coarseOsVersion(r);
  const osLabel = r.os.name === undefined ? "Unknown OS" : osVersion === undefined ? r.os.name : `${r.os.name} ${osVersion}`;
  const os = r.os.name === undefined ? "unknown" : slug(r.os.name);
  const device = r.device.type;
  if (r.bot.isBot && !r.bot.generic && r.bot.name !== undefined) {
    const name = r.bot.name;
    const label = `${name}${r.bot.version === undefined ? "" : ` ${r.bot.version}`} / bot (${r.bot.category ?? "other"})`;
    const id = `${slug(name)}:${os}${osVersion === undefined ? "" : `-${slug(osVersion)}`}:bot`;
    return { label, id, browser: slug(name), browserMajor: undefined, os, osVersion, device, bot: slug(name) };
  }
  const major = r.browser.major === undefined ? undefined : Number(r.browser.major);
  const browserLabel = r.browser.name === undefined ? "Unknown browser" : major === undefined ? r.browser.name : `${r.browser.name} ${major}`;
  const browser = r.browser.name === undefined ? "unknown" : slug(r.browser.name);
  const id = `${browser}${major === undefined ? "" : `-${major}`}:${os}${osVersion === undefined ? "" : `-${slug(osVersion)}`}:${device}`;
  return {
    label: `${browserLabel} / ${osLabel} / ${device}`,
    id,
    browser,
    browserMajor: major,
    os,
    osVersion,
    device,
    bot: r.bot.isBot && r.bot.name !== undefined ? slug(r.bot.name) : undefined,
  };
}

/** Parses and summarises a UA (with optional hints) in one call. */
export function normalize(ua: string | null | undefined, options?: ParseOptions): NormalizedUa {
  return normalizeResult(parse(ua, options));
}
