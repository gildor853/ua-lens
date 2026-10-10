// User-Agent Client Hints (https://wicg.github.io/ua-client-hints/).
// Header values are RFC 9651 Structured Fields; invalid values are ignored and
// reported, never thrown.
import { fail, show } from "./errors.js";
import { parseSfItem, parseSfList, type SfMember } from "./sfv.js";
import type { ClientHintsInput, HeadersLike, UaDataBrand, UaDataValues } from "./types.js";

/** @internal Normalised hints. */
export interface Hints {
  brands: UaDataBrand[] | undefined;
  fullVersionList: UaDataBrand[] | undefined;
  mobile: boolean | undefined;
  platform: string | undefined;
  platformVersion: string | undefined;
  model: string | undefined;
  architecture: string | undefined;
  bitness: string | undefined;
  formFactors: string[] | undefined;
  /** Names (header names, or UA-data property names) of malformed hints. */
  invalid: string[];
  /** Whether any valid hint was present. */
  present: boolean;
}

const HEADER_NAMES = {
  brands: "sec-ch-ua",
  fullVersionList: "sec-ch-ua-full-version-list",
  mobile: "sec-ch-ua-mobile",
  platform: "sec-ch-ua-platform",
  platformVersion: "sec-ch-ua-platform-version",
  model: "sec-ch-ua-model",
  architecture: "sec-ch-ua-arch",
  bitness: "sec-ch-ua-bitness",
  formFactors: "sec-ch-ua-form-factors",
} as const;
type HintKey = keyof typeof HEADER_NAMES;
const HINT_KEYS = Object.keys(HEADER_NAMES) as HintKey[];
const UADATA_KEYS = new Set<string>([...HINT_KEYS, "wow64", "uaFullVersion"]);

/**
 * True for GREASE brands: Chromium's "Not A(Brand" family (any punctuation /
 * spacing around the letters "not a brand") and any brand containing a
 * character from the spec's GREASE set other than space, `-` and `.`.
 * Real brands ("Google Chrome", "Microsoft Edge", "Samsung Internet") never do.
 */
export function isGreaseBrand(brand: string): boolean {
  if (brand.toLowerCase().replace(/[^a-z]/g, "") === "notabrand") return true;
  return /[();:=?/_]/.test(brand);
}

function emptyHints(): Hints {
  return {
    brands: undefined,
    fullVersionList: undefined,
    mobile: undefined,
    platform: undefined,
    platformVersion: undefined,
    model: undefined,
    architecture: undefined,
    bitness: undefined,
    formFactors: undefined,
    invalid: [],
    present: false,
  };
}

/** Brand list from an sf-list: each member a string item with a string `v` parameter. */
function brandList(members: SfMember[]): UaDataBrand[] | undefined {
  const out: UaDataBrand[] = [];
  for (const m of members) {
    if (typeof m.value !== "string") return undefined;
    let version: string | undefined;
    for (const [k, v] of m.params) if (k === "v") version = typeof v === "string" ? v : undefined;
    if (version === undefined) return undefined;
    out.push({ brand: m.value, version });
  }
  return out;
}

function stringList(members: SfMember[]): string[] | undefined {
  const out: string[] = [];
  for (const m of members) {
    if (typeof m.value !== "string") return undefined;
    out.push(m.value);
  }
  return out;
}

function parseHeaderValue(key: HintKey, raw: string): unknown {
  switch (key) {
    case "brands":
    case "fullVersionList": {
      const list = parseSfList(raw);
      return list === undefined ? undefined : brandList(list);
    }
    case "formFactors": {
      const list = parseSfList(raw);
      return list === undefined ? undefined : stringList(list);
    }
    case "mobile": {
      const item = parseSfItem(raw);
      return item !== undefined && typeof item.value === "boolean" ? item.value : undefined;
    }
    default: {
      const item = parseSfItem(raw);
      return item !== undefined && typeof item.value === "string" ? item.value : undefined;
    }
  }
}

function assign(h: Hints, key: HintKey, value: unknown): void {
  switch (key) {
    case "brands":
    case "fullVersionList":
      h[key] = (value as UaDataBrand[]).filter((b) => !isGreaseBrand(b.brand));
      break;
    case "formFactors":
      h.formFactors = value as string[];
      break;
    case "mobile":
      h.mobile = value as boolean;
      break;
    default:
      h[key] = value as string;
  }
  h.present = true;
}

function isHeadersLike(v: object): v is HeadersLike {
  return typeof (v as { get?: unknown }).get === "function";
}

function isUaData(v: object): v is UaDataValues {
  return Object.keys(v).some((k) => UADATA_KEYS.has(k));
}

function fromHeaders(read: (name: string) => unknown, maxLength: number): Hints {
  const h = emptyHints();
  for (const key of HINT_KEYS) {
    const name = HEADER_NAMES[key];
    let raw = read(name);
    if (raw === undefined || raw === null) continue;
    // Several header lines with the same name combine as a comma-separated list (RFC 9110 §5.3).
    if (Array.isArray(raw) && raw.every((x) => typeof x === "string")) raw = raw.join(", ");
    if (typeof raw !== "string" || raw.length > maxLength) {
      h.invalid.push(name);
      continue;
    }
    const value = parseHeaderValue(key, raw);
    if (value === undefined) h.invalid.push(name);
    else assign(h, key, value);
  }
  return h;
}

function validBrands(v: unknown, maxLength: number): UaDataBrand[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: UaDataBrand[] = [];
  for (const b of v as unknown[]) {
    if (typeof b !== "object" || b === null) return undefined;
    const { brand, version } = b as { brand?: unknown; version?: unknown };
    if (typeof brand !== "string" || typeof version !== "string") return undefined;
    if (brand.length > maxLength || version.length > maxLength) return undefined;
    out.push({ brand, version });
  }
  return out;
}

function fromUaData(data: UaDataValues, maxLength: number): Hints {
  const h = emptyHints();
  const src = data as Record<string, unknown>;
  for (const key of HINT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
    const raw = src[key];
    if (raw === undefined) continue;
    let value: unknown;
    if (key === "brands" || key === "fullVersionList") value = validBrands(raw, maxLength);
    else if (key === "formFactors") {
      value =
        Array.isArray(raw) && (raw as unknown[]).every((x) => typeof x === "string" && x.length <= maxLength)
          ? [...(raw as string[])]
          : undefined;
    } else if (key === "mobile") value = typeof raw === "boolean" ? raw : undefined;
    else value = typeof raw === "string" && raw.length <= maxLength ? raw : undefined;
    if (value === undefined) h.invalid.push(key);
    else assign(h, key, value);
  }
  return h;
}

/** @internal Normalises any supported hints input. */
export function readHints(input: ClientHintsInput | undefined | null, maxLength: number): Hints {
  if (input === undefined || input === null) return emptyHints();
  if (typeof input !== "object" || Array.isArray(input)) {
    fail("InvalidOption", `hints must be a headers object, a Headers-like object or navigator.userAgentData values, got ${show(input)}`);
  }
  if (isHeadersLike(input)) {
    const headers = input;
    return fromHeaders((name) => headers.get(name), maxLength);
  }
  if (isUaData(input)) return fromUaData(input, maxLength);
  // Plain header record, case-insensitive names; only own enumerable keys are read.
  const record = input as Record<string, unknown>;
  const byLower = new Map<string, unknown>();
  for (const k of Object.keys(record)) {
    const lower = k.toLowerCase();
    if (lower.startsWith("sec-ch-ua") && !byLower.has(lower)) byLower.set(lower, record[k]);
  }
  return fromHeaders((name) => byLower.get(name), maxLength);
}

/** @internal Reads the `user-agent` header from a supported headers object. */
export function userAgentHeader(headers: unknown): unknown {
  if (headers === undefined || headers === null) return undefined;
  if (typeof headers !== "object" || Array.isArray(headers)) {
    fail("InvalidInput", `parseHeaders: headers must be an object or a Headers-like object, got ${show(headers)}`);
  }
  if (isHeadersLike(headers)) return headers.get("user-agent") ?? undefined;
  const record = headers as Record<string, unknown>;
  for (const k of Object.keys(record)) {
    if (k.toLowerCase() === "user-agent") {
      const v = record[k];
      return Array.isArray(v) ? v[0] : v;
    }
  }
  return undefined;
}

// ------------------------------------------------------------ interpretation

/** Canonical browser names for known brands (lower-cased brand → name). */
const BRAND_NAMES = new Map<string, string>([
  ["google chrome", "Chrome"],
  ["chromium", "Chromium"],
  ["microsoft edge", "Edge"],
  ["microsoft edge webview2", "Edge WebView2"],
  ["android webview", "Chrome WebView"],
  ["opera", "Opera"],
  ["opera gx", "Opera GX"],
  ["brave", "Brave"],
  ["samsung internet", "Samsung Internet"],
  ["yandex", "Yandex"],
  ["yabrowser", "Yandex"],
  ["vivaldi", "Vivaldi"],
  ["duckduckgo", "DuckDuckGo"],
  ["whale", "Whale"],
  ["headlesschrome", "Headless Chrome"],
]);

/** @internal The most specific known brand in the hints, with its version. */
export function hintBrand(h: Hints): { name: string; version: string; full: boolean; chromium: string | undefined } | undefined {
  const list = h.fullVersionList ?? h.brands;
  if (list === undefined) return undefined;
  const full = h.fullVersionList !== undefined;
  let chosen: { name: string; version: string } | undefined;
  let chromium: string | undefined;
  for (const b of list) {
    const name = BRAND_NAMES.get(b.brand.toLowerCase());
    if (name === undefined) continue;
    if (name === "Chromium") {
      chromium = b.version;
      continue;
    }
    if (chosen === undefined || chosen.name === "Chrome") chosen = { name, version: b.version };
  }
  if (chosen === undefined && chromium !== undefined) chosen = { name: "Chromium", version: chromium };
  return chosen === undefined ? undefined : { ...chosen, full, chromium: full ? chromium : undefined };
}

/** @internal Sec-CH-UA-Platform → canonical OS name. */
export function hintPlatform(platform: string): string | undefined {
  switch (platform.toLowerCase()) {
    case "windows":
      return "Windows";
    case "macos":
      return "macOS";
    case "linux":
      return "Linux";
    case "android":
      return "Android";
    case "chrome os":
    case "chromeos":
      return "ChromeOS";
    case "ios":
      return "iOS";
    case "fuchsia":
      return "Fuchsia";
    default:
      return undefined;
  }
}

/**
 * @internal Sec-CH-UA-Platform-Version → OS version. On Windows the value is a
 * Windows.Foundation.UniversalApiContract version: 13+ is Windows 11, 1–10 is
 * Windows 10, 0.1 / 0.2 / 0.3 are Windows 7 / 8 / 8.1. Elsewhere trailing `.0`
 * components are dropped (`14.0.0` → `14`).
 */
export function hintPlatformVersion(os: string | undefined, raw: string): string | undefined {
  const m = /^(\d{1,6})(?:\.(\d{1,6}))?(?:\.(\d{1,6}))?$/.exec(raw);
  if (m === null) return undefined;
  const major = Number(m[1]);
  const minor = Number(m[2] ?? "0");
  if (os === "Windows") {
    if (major >= 13) return "11";
    if (major >= 1 && major <= 10) return "10";
    if (major === 0) return minor === 1 ? "7" : minor === 2 ? "8" : minor === 3 ? "8.1" : undefined;
    return undefined;
  }
  return raw.replace(/(?:\.0){1,2}$/, "");
}

/** @internal Sec-CH-UA-Arch + Sec-CH-UA-Bitness → architecture. */
export function hintArchitecture(arch: string, bitness: string | undefined): "amd64" | "ia32" | "arm64" | "arm" | "x86" | undefined {
  const a = arch.toLowerCase();
  if (a === "x86") return bitness === "64" ? "amd64" : bitness === "32" ? "ia32" : "x86";
  if (a === "arm") return bitness === "64" ? "arm64" : "arm";
  return undefined;
}

/** @internal Sec-CH-UA-Form-Factors → device type (most specific first). */
export function hintFormFactor(list: readonly string[]): "xr" | "wearable" | "embedded" | "tablet" | "mobile" | "desktop" | undefined {
  const set = new Set(list.map((f) => f.toLowerCase()));
  if (set.has("xr")) return "xr";
  if (set.has("watch")) return "wearable";
  if (set.has("automotive")) return "embedded";
  if (set.has("tablet")) return "tablet";
  if (set.has("mobile")) return "mobile";
  if (set.has("eink")) return "embedded";
  if (set.has("desktop")) return "desktop";
  return undefined;
}
