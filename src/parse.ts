import { detectBotIn } from "./bots.js";
import {
  ANDROID_WEBVIEW,
  BROWSER_RULES,
  CPU_RULES,
  DESKTOP,
  DEVICE_RULES,
  INSTAGRAM_ANDROID,
  OS_RULES,
  MOZILLA_PREFIX,
  REDUCED_CHROME,
  REDUCED_VERSION,
  SAFARI_TOKEN,
  VENDOR_RULES,
  WINDOWS_NT,
  type BrowserRule,
} from "./data/rules.js";
import {
  hintArchitecture,
  hintBrand,
  hintFormFactor,
  hintPlatform,
  hintPlatformVersion,
  readHints,
  userAgentHeader,
  type Hints,
} from "./hints.js";
import { maxLengthOption, optionsObject, uaInput } from "./input.js";
import type {
  BrowserInfo,
  ClientHintsInput,
  CpuInfo,
  DeviceInfo,
  FrozenField,
  HeaderRecord,
  HeadersLike,
  OsFamily,
  OsInfo,
  ParseOptions,
  ParseResult,
} from "./types.js";

const CHROME_FAMILY = new Set(["Chrome", "Chrome Mobile", "Chrome WebView", "Chromium"]);
const BROWSER_LIKE = /\b(?:AppleWebKit|Gecko|Trident|Presto)\//;

/** First defined capture group (patterns may use alternations with one group each). */
function group(m: RegExpExecArray | null): string | undefined {
  if (m === null) return undefined;
  for (let i = 1; i < m.length; i++) if (m[i] !== undefined) return m[i];
  return undefined;
}

function majorOf(version: string | undefined): string | undefined {
  if (version === undefined) return undefined;
  const m = /^\d{1,8}/.exec(version);
  return m === null ? undefined : m[0];
}

interface Ctx {
  ua: string;
  frozen: Set<FrozenField>;
  applied: string[];
}

// ------------------------------------------------------------------ OS
function parseOs(ctx: Ctx): OsInfo {
  const { ua } = ctx;
  for (const rule of OS_RULES) {
    const m = rule.pattern.exec(ua);
    if (m === null) continue;
    const raw = rule.version === undefined ? group(m) : group(rule.version.exec(ua));
    const os: OsInfo = { name: rule.name, version: undefined, reportedVersion: raw, family: rule.family };
    if (raw === undefined) return os;
    const dotted = raw.replace(/_/g, ".");
    switch (rule.name) {
      case "Windows":
        if (raw === "10.0") ctx.frozen.add("os.version");
        else os.version = WINDOWS_NT.get(raw) ?? (/^\d/.test(raw) ? undefined : raw);
        break;
      case "macOS":
        // Every Safari / Chrome / Firefox on macOS 11+ reports 10_15_7 (Firefox: 10.15).
        if (dotted === "10.15.7" || dotted === "10.15") ctx.frozen.add("os.version");
        else os.version = dotted;
        break;
      case "iOS": {
        // Safari 26 freezes the iOS version at 18.6 / 18.6.2 / 18.7 (WebKit bugs 298260, 298473).
        const safari = /\bVersion\/(\d{1,3})/.exec(ua);
        if ((dotted === "18.6" || dotted === "18.6.2" || dotted === "18.7") && safari !== null && Number(safari[1]) >= 26) {
          ctx.frozen.add("os.version");
        } else os.version = dotted;
        break;
      }
      case "Android":
        // Reduced UA: "Android 10; K".
        if (raw === "10" && /\bAndroid 10; K\)/.test(ua)) ctx.frozen.add("os.version");
        else os.version = dotted;
        break;
      case "ChromeOS":
        if (REDUCED_CHROME.test(ua)) ctx.frozen.add("os.version");
        else os.version = dotted;
        break;
      default:
        os.version = dotted;
    }
    return os;
  }
  return { name: undefined, version: undefined, reportedVersion: undefined, family: undefined };
}

/**
 * The first parenthesised section of a Mozilla-style UA, allowing nested
 * brackets such as "moto g(7)". A plain scan instead of a regex keeps it linear.
 */
function platformSection(ua: string): string | undefined {
  const m = MOZILLA_PREFIX.exec(ua);
  if (m === null) return undefined;
  const start = m[0].length;
  let depth = 1;
  for (let i = start; i < ua.length && i < start + 400; i++) {
    const ch = ua.charCodeAt(i);
    if (ch === 40) depth++;
    else if (ch === 41 && --depth === 0) return ua.slice(start, i);
  }
  return undefined;
}

// ------------------------------------------------------------------ device
function vendorOf(model: string): string | undefined {
  for (const [pattern, vendor] of VENDOR_RULES) if (pattern.test(model)) return vendor;
  return undefined;
}

function androidModel(ua: string): string | undefined {
  const insta = INSTAGRAM_ANDROID.exec(ua);
  if (insta !== null) {
    const parts = (insta[1] as string).split(";").map((s) => s.trim());
    return parts[4] !== undefined && parts[4] !== "" ? parts[4] : undefined;
  }
  const section = platformSection(ua);
  if (section === undefined) return undefined;
  const parts = section.split(";").map((s) => s.trim());
  const at = parts.findIndex((p) => /^Android(?: \d|$)/.test(p));
  if (at < 0) return undefined;
  for (const p of parts.slice(at + 1)) {
    if (p === "" || p === "U" || p === "wv" || p === "Mobile" || p === "Tablet") continue;
    if (/^[a-z]{2,3}(?:[-_][A-Za-z]{2,4})?$/.test(p)) continue; // locale
    if (/^(?:arm|arm_64|aarch64|x86|x86_64)$/.test(p)) continue;
    if (/^HMSCore\b/.test(p) || /^rv:/.test(p)) continue;
    const model = p.replace(/\s{1,10}Build\/[^\s;]{0,80}$/, "").trim();
    return model === "" ? undefined : model;
  }
  return undefined;
}

function parseDevice(ctx: Ctx, os: OsInfo): DeviceInfo {
  const { ua } = ctx;
  let type: DeviceInfo["type"] = "unknown";
  for (const rule of DEVICE_RULES) {
    if (rule.type === "mobile" && os.name === "Android") {
      // Chrome's guidance: Android without "Mobile" is a tablet.
      type = /\bMobile\b/.test(ua) || !BROWSER_LIKE.test(ua) ? "mobile" : "tablet";
      break;
    }
    if (rule.pattern.test(ua)) {
      type = rule.type;
      break;
    }
  }
  if (type === "unknown" && DESKTOP.test(ua)) type = "desktop";

  let vendor: string | undefined;
  let reportedModel: string | undefined;
  if (os.name === "iOS" || os.name === "watchOS") {
    vendor = "Apple";
    reportedModel = /\biPad\b/.test(ua) ? "iPad" : /\biPod\b/.test(ua) ? "iPod" : /\biPhone\b/.test(ua) ? "iPhone" : undefined;
    if (os.name === "watchOS") reportedModel = "Apple Watch";
  } else if (os.name === "macOS") {
    vendor = "Apple";
    reportedModel = "Macintosh";
  } else if (os.name === "Android") {
    reportedModel = androidModel(ua);
  }
  const console =
    /\b(Xbox (?:One|Series [SX]))\b/.exec(ua) ?? /\b(Xbox|PlayStation (?:4|5|3|Vita|Portable)|Nintendo (?:Switch|WiiU|Wii|3DS))\b/.exec(ua);
  const quest = /\b(Quest(?: \d| Pro)?)\b/.exec(ua);
  if (console !== null) {
    reportedModel = console[1];
    vendor = reportedModel?.startsWith("Xbox") ? "Microsoft" : reportedModel?.startsWith("PlayStation") ? "Sony" : "Nintendo";
  } else if (quest !== null) {
    reportedModel = quest[1];
    vendor = "Meta";
  }
  let model = reportedModel;
  if (reportedModel === "K" && os.name === "Android") {
    ctx.frozen.add("device.model");
    model = undefined;
  } else if (model !== undefined && vendor === undefined) {
    vendor = vendorOf(model);
    if (vendor === "Samsung") model = model.replace(/^SAMSUNG[ -]/i, "");
  }
  return { type, vendor, model, reportedModel };
}

// ------------------------------------------------------------------ CPU
function parseCpu(ctx: Ctx, os: OsInfo, device: DeviceInfo, reduced: boolean): CpuInfo {
  const { ua } = ctx;
  // Quest / VR browsers claim "X11; Linux x86_64" on ARM hardware.
  if (device.type === "xr") return { architecture: undefined };
  // Intel Macs and Apple-silicon Macs send the same "Intel Mac OS X" in every browser.
  if (os.name === "macOS" || os.name === "iOS") {
    if (/\bIntel Mac OS X\b/.test(ua)) ctx.frozen.add("cpu.architecture");
    return { architecture: undefined };
  }
  // Reduced Chrome freezes "Win64; x64" and "X11; Linux x86_64" regardless of the real CPU.
  if (reduced && (/\bWindows NT [\d.]{1,8}; Win64; x64\)/.test(ua) || /\bX11; (?:CrOS|Linux) x86_64\b/.test(ua))) {
    ctx.frozen.add("cpu.architecture");
    return { architecture: undefined };
  }
  const section = platformSection(ua) ?? ua;
  for (const [pattern, arch] of CPU_RULES) if (pattern.test(section)) return { architecture: arch };
  return { architecture: undefined };
}

// ------------------------------------------------------------------ browser
function engineOf(ua: string, name: string | undefined, os: OsInfo, version: string | undefined): BrowserInfo["engine"] {
  const webkit = /\bAppleWebKit\/([\d.+]{1,20})/.exec(ua)?.[1];
  const webkitVersion = webkit === undefined || webkit.startsWith("605.1.15") ? undefined : webkit.replace(/\+$/, "");
  if (os.name === "iOS" || os.name === "watchOS") return { name: "WebKit", version: webkitVersion };
  if (name === "Edge Legacy") return { name: "EdgeHTML", version };
  const chrome = /\b(?:Chrome|HeadlessChrome|Chromium)\/(\d{1,4})((?:\.\d{1,10}){0,3})/.exec(ua);
  if (chrome !== null && Number(chrome[1]) >= 28) {
    const full = `${chrome[1]}${chrome[2]}`;
    return { name: "Blink", version: REDUCED_VERSION.test(full) ? undefined : full };
  }
  const trident = /\bTrident\/([\d.]{1,10})/.exec(ua);
  if (trident !== null) return { name: "Trident", version: trident[1] };
  const presto = /\bPresto\/([\d.]{1,10})/.exec(ua);
  if (presto !== null) return { name: "Presto", version: presto[1] };
  const gecko = /\brv:([\d.]{1,12})\) Gecko\//.exec(ua);
  if (gecko !== null) return { name: "Gecko", version: gecko[1] };
  if (webkit !== undefined) return { name: "WebKit", version: webkitVersion };
  return { name: undefined, version: undefined };
}

function parseBrowser(ctx: Ctx, os: OsInfo): BrowserInfo {
  const { ua } = ctx;
  let rule: BrowserRule | undefined;
  let reportedVersion: string | undefined;
  for (const r of BROWSER_RULES) {
    const m = r.pattern.exec(ua);
    if (m === null) continue;
    rule = r;
    reportedVersion = (r.version === undefined ? undefined : group(r.version.exec(ua))) ?? group(m);
    break;
  }
  let name = rule?.name;
  let webview = rule?.webview === true;
  const apple = os.name === "iOS";
  if (name === "Chrome") {
    if (os.name === "Android" && ANDROID_WEBVIEW.test(ua)) {
      name = "Chrome WebView";
      webview = true;
    } else if (os.name === "Android" || apple) name = "Chrome Mobile";
  } else if (name === "Safari" && apple) {
    name = "Mobile Safari";
  } else if (name === "Safari" && os.name === "Android") {
    name = "Android Browser"; // pre-Chrome AOSP browser: Version/4.0 … Safari/534.30
  } else if (name === undefined && apple && /\bAppleWebKit\//.test(ua) && !SAFARI_TOKEN.test(ua)) {
    name = "WKWebView";
    webview = true;
  }
  let version = reportedVersion;
  if (version !== undefined && REDUCED_VERSION.test(version)) {
    ctx.frozen.add("browser.version");
    version = undefined;
  }
  return {
    name,
    version,
    major: majorOf(reportedVersion),
    reportedVersion,
    engine: engineOf(ua, name, os, reportedVersion),
    inApp: rule?.inApp === true,
    webview,
  };
}

// ------------------------------------------------------------------ hints
function applyHints(ctx: Ctx, h: Hints, r: Omit<ParseResult, "hints" | "frozen" | "confidence">): void {
  const { applied, frozen } = ctx;
  if (h.platform !== undefined) {
    const name = hintPlatform(h.platform);
    if (name !== undefined && name !== r.os.name) {
      r.os = { name, version: undefined, reportedVersion: r.os.reportedVersion, family: familyOf(name) };
      frozen.delete("os.version");
      applied.push("os.name");
    }
  }
  if (h.platformVersion !== undefined && h.platformVersion !== "") {
    const v = hintPlatformVersion(r.os.name, h.platformVersion);
    if (v !== undefined) {
      r.os.version = v;
      frozen.delete("os.version");
      applied.push("os.version");
    }
  }
  if (h.model !== undefined && h.model !== "") {
    r.device.model = h.model;
    r.device.vendor = vendorOf(h.model) ?? r.device.vendor;
    frozen.delete("device.model");
    applied.push("device.model");
  }
  if (h.architecture !== undefined && h.architecture !== "") {
    const arch = hintArchitecture(h.architecture, h.bitness);
    if (arch !== undefined) {
      r.cpu.architecture = arch;
      frozen.delete("cpu.architecture");
      applied.push("cpu.architecture");
    }
  }
  if (r.device.type !== "bot") {
    const ff = h.formFactors === undefined ? undefined : hintFormFactor(h.formFactors);
    if (ff !== undefined && ff !== r.device.type) {
      r.device.type = ff;
      applied.push("device.type");
    } else if (ff === undefined && h.mobile === true && (r.device.type === "unknown" || r.device.type === "desktop")) {
      r.device.type = "mobile";
      applied.push("device.type");
    } else if (ff === undefined && h.mobile === false && r.device.type === "unknown" && isDesktopOs(r.os.name)) {
      r.device.type = "desktop";
      applied.push("device.type");
    }
  }
  const brand = hintBrand(h);
  if (brand !== undefined) {
    const current = r.browser.name;
    let name = current;
    const brandIsChrome = brand.name === "Chrome" || brand.name === "Chromium";
    if (current === undefined || (CHROME_FAMILY.has(current) && !brandIsChrome) || (!brandIsChrome && brand.name !== current)) {
      name = brand.name === "Chrome" && (r.os.name === "Android" || r.device.type === "mobile") ? "Chrome Mobile" : brand.name;
    }
    if (name !== current) {
      r.browser.name = name;
      r.browser.inApp = false;
      r.browser.webview = name === "Chrome WebView" || name === "Edge WebView2";
      applied.push("browser.name");
    }
    const sameFamily = brand.name === name || (brandIsChrome && name !== undefined && CHROME_FAMILY.has(name)) || name === "Headless Chrome";
    if (sameFamily) {
      const major = majorOf(brand.version);
      if (brand.full && !REDUCED_VERSION.test(brand.version)) {
        r.browser.version = brand.version;
        r.browser.major = major;
        frozen.delete("browser.version");
        applied.push("browser.version");
      } else if (major !== undefined && r.browser.major === undefined) {
        r.browser.major = major;
        applied.push("browser.major");
      }
    }
    if (brand.chromium !== undefined && r.browser.engine.name !== "WebKit") {
      r.browser.engine = { name: "Blink", version: brand.chromium };
      applied.push("browser.engine");
    }
  }
}

function familyOf(name: string): OsFamily {
  switch (name) {
    case "Windows":
      return "windows";
    case "macOS":
    case "iOS":
      return "apple";
    case "Android":
      return "android";
    case "ChromeOS":
      return "chromeos";
    case "Linux":
      return "linux";
    default:
      return "other";
  }
}

function isDesktopOs(name: string | undefined): boolean {
  return name === "Windows" || name === "macOS" || name === "Linux" || name === "ChromeOS";
}

// ------------------------------------------------------------------ public
/** @internal Parse an already validated, capped UA. */
export function parseIn(ua: string, truncated: boolean, h: Hints): ParseResult {
  const ctx: Ctx = { ua, frozen: new Set(), applied: [] };
  const bot = detectBotIn(ua);
  const reduced = (() => {
    const m = REDUCED_CHROME.exec(ua);
    return m !== null && Number(m[1]) >= 100;
  })();
  const os = parseOs(ctx);
  const device = parseDevice(ctx, os);
  const cpu = parseCpu(ctx, os, device, reduced);
  const browser = parseBrowser(ctx, os);
  if (bot.isBot) device.type = "bot";
  const partial = { ua, truncated, browser, os, device, cpu, bot, reduced };
  if (h.present) applyHints(ctx, h, partial);
  const order: FrozenField[] = ["browser.version", "os.version", "device.model", "cpu.architecture"];
  const frozen = order.filter((f) => ctx.frozen.has(f));
  const confidence: ParseResult["confidence"] =
    partial.browser.name === undefined ? "low" : frozen.length > 0 || partial.os.name === undefined ? "medium" : "high";
  return {
    ...partial,
    frozen,
    confidence,
    hints: {
      used: h.present,
      applied: ctx.applied,
      invalid: h.invalid,
      brands: (h.fullVersionList ?? h.brands ?? []).map((b) => ({ brand: b.brand, version: b.version })),
    },
  };
}

/**
 * Parses a User-Agent string, optionally refined by User-Agent Client Hints.
 * Never throws for string / null / undefined input; throws {@link UaLensError}
 * only for invalid argument types or options.
 */
export function parse(ua: string | null | undefined, options?: ParseOptions): ParseResult {
  const opts = optionsObject<ParseOptions>(options, "parse");
  const maxLength = maxLengthOption(opts.maxLength);
  const input = uaInput(ua, maxLength, "parse");
  return parseIn(input.ua, input.truncated, readHints(opts.hints, maxLength));
}

/**
 * Parses straight from request headers: reads `User-Agent` and every
 * `Sec-CH-UA*` hint from a Node-style header record or a Fetch `Headers` object.
 */
export function parseHeaders(headers: HeaderRecord | HeadersLike | null | undefined, options?: Omit<ParseOptions, "hints">): ParseResult {
  const opts = optionsObject<ParseOptions>(options, "parseHeaders");
  const maxLength = maxLengthOption(opts.maxLength);
  const input = uaInput(userAgentHeader(headers), maxLength, "parseHeaders");
  const hints = headers === null || headers === undefined ? undefined : (headers as ClientHintsInput);
  return parseIn(input.ua, input.truncated, readHints(hints, maxLength));
}

/** True when the device is a phone (tablets are not mobile here; check `device.type` for both). */
export function isMobile(ua: string | null | undefined, options?: ParseOptions): boolean {
  return parse(ua, options).device.type === "mobile";
}
