// Ordered, data-driven rule tables. The first matching rule wins.
//
// Every pattern is written to run in linear time: no nested quantifiers, no
// quantified alternations, and every "skip ahead" is a bounded negated class
// such as [^)]{0,200}. test/redos.test.ts enforces this on every RegExp
// exported here, and fuzzes them with adversarial inputs.
import type { CpuArchitecture, DeviceType, OsFamily } from "../types.js";

/** Version capture: up to five dot-separated numeric parts. */
const V = String.raw`(\d{1,8}(?:\.\d{1,10}){0,4})`;
const re = (source: string, flags = ""): RegExp => new RegExp(source, flags);

/** Browser rule. The version comes from `version` when it matches, else from the first group of `pattern`. */
export interface BrowserRule {
  name: string;
  pattern: RegExp;
  version?: RegExp;
  inApp?: true;
  webview?: true;
}

export const BROWSER_RULES: readonly BrowserRule[] = [
  // In-app browsers first: they embed a full browser UA.
  { name: "Facebook", pattern: /\bFB(?:AN|AV|_IAB|IOS|4A)\b/, version: re(String.raw`\bFBAV/${V}`), inApp: true, webview: true },
  { name: "Instagram", pattern: re(String.raw`\bInstagram ${V}`), inApp: true, webview: true },
  {
    name: "TikTok",
    // musical_ly_<version> on iOS, musical_ly_<build number> plus app_version/<version> on Android.
    pattern: /\b(?:musical_ly|trill)_(?:(\d{1,4}(?:\.\d{1,6}){1,3})\b|\d)/,
    version: re(String.raw`\bapp_version/${V}`),
    inApp: true,
    webview: true,
  },
  { name: "LinkedIn", pattern: re(String.raw`\bLinkedInApp\]?(?:/${V})?`), inApp: true, webview: true },
  { name: "WeChat", pattern: re(String.raw`\bMicroMessenger/${V}`), inApp: true, webview: true },
  { name: "Line", pattern: re(String.raw` Line/${V}`), inApp: true, webview: true },
  // Automation / embedded runtimes.
  { name: "Headless Chrome", pattern: re(String.raw`\bHeadlessChrome(?:/${V})?`) },
  { name: "PhantomJS", pattern: re(String.raw`\bPhantomJS/${V}`) },
  { name: "Electron", pattern: re(String.raw`\bElectron/${V}`) },
  // Chromium-based and other browsers that also carry a Chrome/ or Safari/ token.
  { name: "Brave", pattern: /(?:^|[^A-Za-z])[Bb]rave(?![A-Za-z])/ },
  { name: "Edge Legacy", pattern: re(String.raw`\bEdge/${V}`) },
  { name: "Edge", pattern: re(String.raw`\bEdg(?:A|iOS)?/${V}`) },
  { name: "Opera Mini", pattern: re(String.raw`\bOpera Mini(?:/(?:att/)?${V})?|\bOPiOS/${V}`) },
  { name: "Opera", pattern: re(String.raw`\b(?:OPR|OPT)/${V}`) },
  { name: "Opera", pattern: re(String.raw`\bOpera/9\.80\b[^\n]{0,300}?\bVersion/${V}`) },
  { name: "Opera", pattern: re(String.raw`\bOpera[ /]${V}`) },
  { name: "Samsung Internet", pattern: re(String.raw`\bSamsungBrowser/${V}`) },
  { name: "Yandex", pattern: re(String.raw`\bYa(?:Search)?Browser/${V}`) },
  { name: "Vivaldi", pattern: re(String.raw`\bVivaldi/${V}`) },
  { name: "Whale", pattern: re(String.raw`\bWhale/${V}`) },
  { name: "UC Browser", pattern: re(String.raw`\b(?:UCBrowser|UCMobile|UBrowser)/${V}`) },
  { name: "MIUI Browser", pattern: re(String.raw`\bMiuiBrowser/${V}`) },
  { name: "Huawei Browser", pattern: re(String.raw`\bHuaweiBrowser/${V}`) },
  { name: "DuckDuckGo", pattern: re(String.raw`\b(?:Ddg|DuckDuckGo)/${V}`) },
  { name: "Silk", pattern: re(String.raw`\bSilk/${V}`) },
  { name: "Oculus Browser", pattern: re(String.raw`\bOculusBrowser/${V}`) },
  { name: "Firefox Focus", pattern: re(String.raw`\bFocus/${V}`) },
  { name: "Firefox", pattern: re(String.raw`\b(?:Firefox|FxiOS)/${V}`) },
  // Chrome family; the final name (Chrome / Chrome Mobile / Chrome WebView) depends on OS and WebView markers.
  { name: "Chrome", pattern: re(String.raw`\bCriOS/${V}`) },
  { name: "Chromium", pattern: re(String.raw`\bChromium/${V}`) },
  { name: "Chrome", pattern: re(String.raw`\bChrome/${V}`) },
  { name: "IE", pattern: re(String.raw`\bTrident/7\.0\b[^)]{0,300}?\brv:${V}`) },
  { name: "IE", pattern: re(String.raw`\bMSIE ${V}`) },
  // Safari last: almost every WebKit/Blink UA contains "Safari/".
  { name: "Safari", pattern: re(String.raw`\bVersion/${V}[^)]{0,80}?\bSafari\b`) },
  // Safari 1–2 had no Version/ token.
  { name: "Safari", pattern: /\bMac OS X[^)]{0,80}\) AppleWebKit\/[\d.]{1,20} \(KHTML, like Gecko\) Safari\/[\d.]{1,20}$/ },
];

/** Android WebView markers (`; wv)` since Lollipop, `Version/4.0 Chrome/` before). */
export const ANDROID_WEBVIEW = /; wv\)|\bVersion\/4\.0 (?:Mobile )?(?:Safari\/[\d.]{1,20} )?Chrome\//;
/** iOS WKWebView: an Apple mobile UA without a Safari/ token. */
export const SAFARI_TOKEN = /\bSafari\b/;
/** Chromium reduced UA: `Chrome/<major>.0.0.0` (also HeadlessChrome). */
export const REDUCED_CHROME = /\b(?:Headless)?Chrome\/(\d{1,4})\.0\.0\.0\b/;
/** A reported browser version that is a reduction placeholder. */
export const REDUCED_VERSION = /^\d{1,4}\.0\.0\.0$/;

/** OS rule; group 1 of `pattern` (or of `version`) is the raw version. */
export interface OsRule {
  name: string;
  family: OsFamily;
  pattern: RegExp;
  version?: RegExp;
}

export const OS_RULES: readonly OsRule[] = [
  { name: "Windows", family: "windows", pattern: /\bXbox\b/ },
  { name: "Windows Phone", family: "windows", pattern: re(String.raw`\bWindows Phone(?: OS)?(?: ${V})?`) },
  { name: "Windows", family: "windows", pattern: re(String.raw`\bWindows NT ${V}`) },
  { name: "Windows", family: "windows", pattern: /\bWindows (98|95|ME|XP|2000|CE)\b/ },
  { name: "watchOS", family: "apple", pattern: re(String.raw`\bwatchOS/${V}`) },
  {
    name: "iOS",
    family: "apple",
    pattern: /\b(?:iPhone|iPad|iPod)\b/,
    version: /\bOS (\d{1,3}(?:_\d{1,3}){0,3})(?: like Mac OS X|;)|\biOS (\d{1,3}(?:[._]\d{1,3}){0,3})\b/,
  },
  { name: "iOS", family: "apple", pattern: re(String.raw`\biOS[ /]${V}`) },
  { name: "macOS", family: "apple", pattern: /\bMac OS X (\d{2}(?:[._]\d{1,2}){1,2})\b/ },
  { name: "macOS", family: "apple", pattern: /\b(?:Macintosh|Mac OS X)\b/ },
  { name: "HarmonyOS", family: "other", pattern: re(String.raw`\b(?:OpenHarmony|HarmonyOS)(?: ${V})?`) },
  { name: "KaiOS", family: "linux", pattern: re(String.raw`\bKAIOS/${V}`, "i") },
  { name: "Tizen", family: "linux", pattern: re(String.raw`\bTizen(?: ${V})?`) },
  {
    name: "Android",
    family: "android",
    pattern: /\bAndroid\b/,
    version: re(String.raw`\bAndroid \(\d{1,3}/${V};|\bAndroid[ /]${V}`),
  },
  // Meta Quest (Horizon OS is Android-based) sends a desktop-Linux-looking UA.
  { name: "Android", family: "android", pattern: /\b(?:Quest(?: \d| Pro)?|OculusBrowser)\b/ },
  { name: "ChromeOS", family: "chromeos", pattern: re(String.raw`\bCrOS [A-Za-z0-9_]{1,20} ${V}`) },
  { name: "webOS", family: "linux", pattern: /\b(?:Web0S|webOS)\b/ },
  { name: "PlayStation", family: "other", pattern: re(String.raw`\bPlayStation (?:4|5|3|Vita|Portable)\b(?:[ /]${V})?`) },
  { name: "Nintendo", family: "other", pattern: /\bNintendo (?:Switch|WiiU|Wii|3DS)\b/ },
  { name: "FreeBSD", family: "bsd", pattern: /\bFreeBSD\b/ },
  { name: "OpenBSD", family: "bsd", pattern: /\bOpenBSD\b/ },
  { name: "NetBSD", family: "bsd", pattern: /\bNetBSD\b/ },
  { name: "Solaris", family: "other", pattern: /\bSunOS\b/ },
  { name: "Windows", family: "windows", pattern: /\b(?:Windows|Win32|Win64|WinNT)\b/ },
  { name: "Linux", family: "linux", pattern: /\b(?:Linux|X11|Ubuntu|Fedora)\b/ },
];

/** Windows NT version → marketing version (NT 10.0 covers both 10 and 11, so it maps to undefined). */
export const WINDOWS_NT: ReadonlyMap<string, string> = new Map([
  ["6.3", "8.1"],
  ["6.2", "8"],
  ["6.1", "7"],
  ["6.0", "Vista"],
  ["5.2", "XP"],
  ["5.1", "XP"],
  ["5.0", "2000"],
]);

/** Device rule, tried in order. */
export interface DeviceRule {
  type: DeviceType;
  pattern: RegExp;
}

export const DEVICE_RULES: readonly DeviceRule[] = [
  { type: "xr", pattern: /\b(?:OculusBrowser|Quest(?: \d| Pro)?|Pacific|Mobile VR|VR Safari|PicoBrowser)\b/ },
  { type: "console", pattern: /\b(?:Xbox|PlayStation|PLAYSTATION|Nintendo)\b/ },
  {
    type: "tv",
    pattern:
      /\b(?:SMART-TV|SmartTV|Smart-TV|SmartHub|Web0S|webOS\.TV|HbbTV|CrKey|AppleTV|Apple TV|BRAVIA|GoogleTV|Android TV|AndroidTV|AFT[A-Z]{1,4}|TV Safari|Large Screen|NetCast|Roku|Viera)\b/,
  },
  { type: "wearable", pattern: /\b(?:watchOS|Watch\d{1,2},\d{1,2}|SM-R\d{3,4}|Wear OS)\b/ },
  { type: "embedded", pattern: /\bKindle\/\d/ },
  { type: "tablet", pattern: /\b(?:iPad|KF[A-Z]{2,6})\b|; Tablet;/ },
  { type: "mobile", pattern: /\b(?:iPhone|iPod|Mobile|Windows Phone|KAIOS|BlackBerry|BB10|Opera Mini|Opera Mobi|IEMobile|Symbian|MIDP)\b/ },
];

/** Desktop markers, checked after the mobile rules (and after the Android tablet rule). */
export const DESKTOP = /\b(?:Windows NT|Windows (?:98|95|ME|XP|2000)|Macintosh|Mac OS X|X11|CrOS|Linux x86_64|Win64|WOW64)\b/;

/** Model string (without vendor prefix) → vendor. */
export const VENDOR_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(?:SAMSUNG|Samsung|SM-|GT-|SGH-|SCH-|SHV-|SPH-)/, "Samsung"],
  [/^(?:Pixel|Nexus)\b/, "Google"],
  [/^(?:Redmi|POCO|Xiaomi|Mi \d|MI \d|M\d{4}[A-Z]\d{1,3}[A-Z]{1,4}$|2\d{3}[0-9A-Z]{4,8}$)/, "Xiaomi"],
  [/^(?:ONEPLUS|OnePlus)/, "OnePlus"],
  [/^(?:HUAWEI|Huawei)/, "Huawei"],
  [/^(?:moto|Moto|Motorola|XT\d{4})/, "Motorola"],
  [/^(?:LG-|LM-|LG )/, "LG"],
  [/^(?:Xperia|SO-\d{2}[A-Z])/, "Sony"],
  [/^CPH\d{4}/, "OPPO"],
  [/^RMX\d{4}/, "realme"],
  [/^(?:vivo |V\d{4}[A-Z]?$)/, "vivo"],
  [/^Nokia/, "Nokia"],
  [/^HTC/, "HTC"],
  [/^(?:Lenovo)/, "Lenovo"],
  [/^(?:ASUS|Asus)/, "ASUS"],
  [/^(?:KF[A-Z]{2,6}|AFT[A-Z]{1,4})$/, "Amazon"],
  [/^Quest\b/, "Meta"],
];

/** CPU tokens in the UA platform section. */
export const CPU_RULES: ReadonlyArray<readonly [RegExp, CpuArchitecture]> = [
  [/\b(?:aarch64|arm64|arm_64|ARM64)\b/, "arm64"],
  [/\b(?:x86_64|x64|Win64|WOW64|amd64|x86-64)\b/, "amd64"],
  [/\b(?:armv\d{1,2}[a-z]{0,2}|arm|ARM)\b/, "arm"],
  [/\b(?:i[3-6]86|x86)\b/, "ia32"],
];

/** Start of a Mozilla-style UA; the platform section that follows is extracted by a bracket scanner. */
export const MOZILLA_PREFIX = /^Mozilla\/5\.0[ +]\(/;
/** Instagram's Android UA: `Instagram <ver> Android (<api>/<release>; <dpi>; <res>; <maker>; <model>; …)`. */
export const INSTAGRAM_ANDROID = /\bInstagram [\d.]{1,30} Android \(([^)]{1,400})\)/;
