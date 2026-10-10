/** Coarse device class. `bot` is used when {@link detectBot} recognises the agent. */
export type DeviceType =
  | "desktop"
  | "mobile"
  | "tablet"
  | "tv"
  | "console"
  | "wearable"
  | "xr"
  | "embedded"
  | "bot"
  | "unknown";

/** Operating-system family, useful for coarse grouping. */
export type OsFamily = "windows" | "apple" | "android" | "linux" | "chromeos" | "bsd" | "other";

/**
 * CPU architecture. `x86` and `arm` mean "that family, bitness unknown or 32-bit
 * ARM"; `ia32` / `amd64` / `arm64` are only reported when the bitness is known.
 */
export type CpuArchitecture = "amd64" | "ia32" | "arm64" | "arm" | "x86";

/**
 * A field whose User-Agent value is a known frozen placeholder (UA reduction,
 * macOS 10_15_7, iOS 18.6 on Safari 26, `Android 10; K`, `Windows NT 10.0`)
 * and that Client Hints did not replace.
 */
export type FrozenField = "browser.version" | "os.version" | "device.model" | "cpu.architecture";

export interface EngineInfo {
  /** `Blink`, `WebKit`, `Gecko`, `EdgeHTML`, `Trident` or `Presto`. */
  name: string | undefined;
  /** Engine version when it carries information (frozen WebKit 605.1.15 is reported as undefined). */
  version: string | undefined;
}

export interface BrowserInfo {
  /** Canonical name, e.g. `Chrome`, `Chrome Mobile`, `Chrome WebView`, `Edge`, `Mobile Safari`, `Instagram`. */
  name: string | undefined;
  /** Trustworthy version; undefined when the UA only carries a reduced `X.0.0.0` placeholder and no hint resolved it. */
  version: string | undefined;
  /** Major version (always reported when any version is present, reduced or not). */
  major: string | undefined;
  /** The version exactly as written in the User-Agent string. */
  reportedVersion: string | undefined;
  engine: EngineInfo;
  /** True for in-app browsers (Facebook, Instagram, TikTok, LinkedIn, WeChat, Line). */
  inApp: boolean;
  /** True for embedded web views (Android WebView, iOS WKWebView, in-app browsers). */
  webview: boolean;
}

export interface OsInfo {
  /** `Windows`, `macOS`, `iOS`, `Android`, `ChromeOS`, `Linux`, ... */
  name: string | undefined;
  /** Trustworthy version; undefined when frozen or unknown. Windows uses marketing names (`11`, `10`, `8.1`, `7`, `XP`). */
  version: string | undefined;
  /** The version exactly as written in the User-Agent string (e.g. `10.0`, `10_15_7`). */
  reportedVersion: string | undefined;
  family: OsFamily | undefined;
}

export interface DeviceInfo {
  type: DeviceType;
  vendor: string | undefined;
  /** Model; undefined when the UA carries the frozen `K` placeholder and no hint resolved it. */
  model: string | undefined;
  /** The model exactly as written in the User-Agent string. */
  reportedModel: string | undefined;
}

export interface CpuInfo {
  architecture: CpuArchitecture | undefined;
}

/** Bot categories reported by {@link detectBot}. */
export type BotCategory =
  | "ai-crawler"
  | "ai-assistant"
  | "ai-search"
  | "search-engine"
  | "seo"
  | "social-preview"
  | "monitoring"
  | "feed-reader"
  | "http-library"
  | "headless-browser"
  | "archiver"
  | "security-scanner"
  | "other";

export interface BotResult {
  isBot: boolean;
  category: BotCategory | undefined;
  /** Canonical agent name (the operator's product token), e.g. `GPTBot`. */
  name: string | undefined;
  /** Agent version when present in the UA. */
  version: string | undefined;
  operator: string | undefined;
  /** Operator documentation URL. */
  url: string | undefined;
  /** What the operator documents about robots.txt; undefined when not documented. */
  respectsRobotsTxt: boolean | undefined;
  /** Key into {@link verifyBotHints} when the operator documents a verification method. */
  verification: string | undefined;
  /** True when only the generic "bot / crawler / spider / URL" heuristic matched. */
  generic: boolean;
}

/** How the Client Hints affected a {@link ParseResult}. */
export interface HintsReport {
  /** True when at least one hint was present and valid. */
  used: boolean;
  /** Result fields that were taken from hints (e.g. `browser.version`, `os.version`). */
  applied: string[];
  /** Hint names that were present but malformed and therefore ignored. */
  invalid: string[];
  /** Non-GREASE brands from Sec-CH-UA-Full-Version-List (or Sec-CH-UA). */
  brands: Array<{ brand: string; version: string }>;
}

export interface ParseResult {
  /** The User-Agent string that was parsed (after the length cap). */
  ua: string;
  /** True when the input exceeded `maxLength` and was cut. */
  truncated: boolean;
  browser: BrowserInfo;
  os: OsInfo;
  device: DeviceInfo;
  cpu: CpuInfo;
  bot: BotResult;
  /** True when the UA is a Chromium "reduced" UA (`Chrome/<major>.0.0.0`). */
  reduced: boolean;
  /** Fields that are frozen placeholders in the UA and were not resolved by hints. */
  frozen: FrozenField[];
  /**
   * `high`: browser and OS identified with no unresolved frozen field.
   * `medium`: identified, but some field is frozen (see `frozen`).
   * `low`: browser unknown (empty, unusual or non-browser UA).
   */
  confidence: "high" | "medium" | "low";
  hints: HintsReport;
}

/** One brand entry as exposed by `navigator.userAgentData`. */
export interface UaDataBrand {
  brand: string;
  version: string;
}

/**
 * The object returned by `navigator.userAgentData.getHighEntropyValues([...])`
 * (or its low-entropy subset). All fields are optional.
 */
export interface UaDataValues {
  brands?: readonly UaDataBrand[];
  fullVersionList?: readonly UaDataBrand[];
  mobile?: boolean;
  platform?: string;
  platformVersion?: string;
  model?: string;
  architecture?: string;
  bitness?: string;
  formFactors?: readonly string[];
  wow64?: boolean;
}

/** Anything with a `get(name)` method returning the header value, like the Fetch API `Headers`. */
export interface HeadersLike {
  get(name: string): string | null | undefined;
}

/** A plain header record (names are matched case-insensitively, as in Node's `req.headers`). */
export type HeaderRecord = { readonly [name: string]: string | readonly string[] | undefined };

/** Client Hints input: request headers or a `navigator.userAgentData` values object. */
export type ClientHintsInput = HeaderRecord | HeadersLike | UaDataValues;

export interface ParseOptions {
  /** Client Hints sent with the request (or `navigator.userAgentData` values). */
  hints?: ClientHintsInput | undefined;
  /** Inputs longer than this are cut before parsing (default 2048). Applies to each hint value too. */
  maxLength?: number | undefined;
}
