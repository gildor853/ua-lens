// Real User-Agent strings with the source they were copied from (all retrieved
// 2026-10-10). No string here was written by hand: each comes verbatim from the
// cited page, from ua-parser/uap-core's test files (Apache-2.0), or was captured
// from a real client (noted as "captured").
import type { DeviceType, FrozenField } from "../src/index.js";

export const SRC = {
  mdnUa: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/User-Agent",
  mdnFirefox: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/User-Agent/Firefox",
  mdnSniffing: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent",
  chromiumReduction: "https://www.chromium.org/updates/ua-reduction/",
  edgeUa: "https://learn.microsoft.com/en-us/microsoft-edge/web-platform/user-agent-string",
  samsung: "https://developer.samsung.com/internet/user-agent-string-format.html",
  uap: "https://github.com/ua-parser/uap-core/blob/73e7340c3ed8055051607b296bf46ead7aa5f19e/tests/test_ua.yaml",
  userAgentsNet:
    "https://user-agents.net/string/mozilla-5-0-iphone-cpu-iphone-os-17-6-1-like-mac-os-x-applewebkit-605-1-15-khtml-like-gecko-mobile-15e148-linkedinapp-9-30-2698",
  captured: "captured from google-chrome 154 --headless=new on the build machine",
} as const;

export interface CorpusCase {
  ua: string;
  source: string;
  browser?: string | undefined;
  version?: string | undefined;
  major?: string | undefined;
  engine?: string | undefined;
  os?: string | undefined;
  osVersion?: string | undefined;
  device?: DeviceType;
  vendor?: string | undefined;
  model?: string | undefined;
  arch?: string | undefined;
  reduced?: boolean;
  frozen?: FrozenField[];
  inApp?: boolean;
  webview?: boolean;
  label?: string;
}

export const CORPUS: CorpusCase[] = [
  // ---------------------------------------------------------------- Chrome (reduced UA)
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    source: SRC.mdnUa, browser: "Chrome", version: undefined, major: "143", engine: "Blink", os: "Windows", osVersion: undefined,
    device: "desktop", arch: undefined, reduced: true, frozen: ["browser.version", "os.version", "cpu.architecture"],
    label: "Chrome 143 / Windows 10+ / desktop",
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    source: SRC.mdnUa, browser: "Chrome", major: "143", os: "macOS", osVersion: undefined, device: "desktop", vendor: "Apple",
    reduced: true, frozen: ["browser.version", "os.version", "cpu.architecture"], label: "Chrome 143 / macOS / desktop",
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36",
    source: SRC.mdnUa, browser: "Chrome Mobile", major: "143", os: "Android", osVersion: undefined, device: "mobile", model: undefined,
    reduced: true, frozen: ["browser.version", "os.version", "device.model"], label: "Chrome Mobile 143 / Android / mobile",
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.12.45 Mobile Safari/537.36",
    source: SRC.mdnUa, browser: "Chrome Mobile", version: "143.0.12.45", os: "Android", osVersion: "16", device: "mobile",
    vendor: "Google", model: "Pixel 9", reduced: false, frozen: [],
  },
  {
    ua: "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.1234.56 Safari/537.36",
    source: SRC.chromiumReduction, browser: "Chrome", version: "93.0.1234.56", os: "Windows", osVersion: "8.1", device: "desktop",
    arch: "amd64", reduced: false, frozen: [],
  },
  {
    ua: "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.0.0 Safari/537.36",
    source: SRC.chromiumReduction, browser: "Chrome", version: undefined, major: "93", os: "Windows", osVersion: "8.1",
    frozen: ["browser.version"],
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 9; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.1234.56 Mobile Safari/537.36",
    source: SRC.chromiumReduction, browser: "Chrome Mobile", version: "93.0.1234.56", os: "Android", osVersion: "9", device: "mobile",
    vendor: "Samsung", model: "SM-A205U", frozen: [],
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 9; SM-T810) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.0.0 Safari/537.36",
    source: SRC.chromiumReduction, browser: "Chrome Mobile", major: "93", os: "Android", osVersion: "9", device: "tablet",
    vendor: "Samsung", model: "SM-T810", frozen: ["browser.version"],
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.0.0 Safari/537.36",
    source: SRC.chromiumReduction, browser: "Chrome Mobile", device: "tablet", frozen: ["browser.version", "os.version", "device.model"],
  },
  {
    ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36",
    source: SRC.mdnUa, browser: "Chrome", version: "51.0.2704.103", os: "Linux", device: "desktop", arch: "amd64", frozen: [],
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 4.4.2; Nexus 5 Build/KOT49H) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.122 Mobile Safari/537.36",
    source: SRC.uap, browser: "Chrome Mobile", version: "35.0.1916.122", os: "Android", osVersion: "4.4.2", vendor: "Google", model: "Nexus 5",
  },
  // ---------------------------------------------------------------- Edge / Opera / Samsung / Yandex / Vivaldi / Whale
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
    source: SRC.mdnUa, browser: "Edge", major: "143", engine: "Blink", os: "Windows", reduced: true,
    frozen: ["browser.version", "os.version", "cpu.architecture"],
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 EdgA/141.0.0.0",
    source: SRC.mdnUa, browser: "Edge", major: "141", os: "Android", device: "mobile",
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59",
    source: SRC.mdnUa, browser: "Edge", version: "91.0.864.59", engine: "Blink", reduced: false, frozen: ["os.version"],
  },
  {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_2 like Mac OS X) AppleWebKit/603.2.4 (KHTML, like Gecko) Mobile/14F89 Safari/603.2.4 EdgiOS/41.1.35.1",
    source: SRC.uap, browser: "Edge", version: "41.1.35.1", engine: "WebKit", os: "iOS", osVersion: "10.3.2", device: "mobile",
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.19582",
    source: SRC.edgeUa, browser: "Edge Legacy", version: "18.19582", engine: "EdgeHTML", os: "Windows", device: "desktop",
  },
  {
    ua: "Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Xbox; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Mobile Safari/537.36 Edge/16.16299",
    source: SRC.mdnSniffing, browser: "Edge Legacy", version: "16.16299", os: "Windows", device: "console", vendor: "Microsoft", model: "Xbox One",
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 OPR/124.0.0.0 (Edition developer)",
    source: SRC.mdnUa, browser: "Opera", major: "124", os: "Windows", reduced: true,
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 OPR/92.0.0.0",
    source: SRC.mdnUa, browser: "Opera", major: "92", device: "mobile",
  },
  {
    ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41",
    source: SRC.mdnUa, browser: "Opera", version: "38.0.2220.41", os: "Linux",
  },
  {
    ua: "Opera/9.80 (Windows NT 5.1; U; ru) Presto/2.5.24 Version/10.53",
    source: SRC.uap, browser: "Opera", version: "10.53", engine: "Presto", os: "Windows", osVersion: "XP", device: "desktop",
  },
  {
    ua: "Opera/9.80 (MAUI Runtime; Opera Mini/4.4.39008/37.9178; U; en) Presto/2.12.423 Version/12.16",
    source: SRC.uap, browser: "Opera Mini", version: "4.4.39008", device: "mobile",
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36",
    source: SRC.samsung, browser: "Samsung Internet", version: "24.0", engine: "Blink", os: "Android", device: "mobile", reduced: true,
    frozen: ["os.version", "device.model"],
  },
  {
    ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Safari/537.36",
    source: SRC.samsung, browser: "Samsung Internet", version: "24.0", os: "Linux", device: "desktop", reduced: true,
  },
  {
    ua: "Mozilla/5.0 (SMART-TV; Linux; Tizen 2.3) AppleWebkit/538.1 (KHTML, like Gecko) SamsungBrowser/1.0 TV Safari/538.1",
    source: SRC.samsung, browser: "Samsung Internet", version: "1.0", os: "Tizen", osVersion: "2.3", device: "tv",
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 5.0.2; SAMSUNG SM-G925K Build/LRX22G) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/4.0 Chrome/44.0.2403.133 Mobile VR Safari/537.36",
    source: SRC.samsung, browser: "Samsung Internet", device: "xr", vendor: "Samsung", model: "SM-G925K",
  },
  {
    ua: "Mozilla/5.0 (Linux; Tizen 2.3; SAMSUNG SM-Z130H) AppleWebKit/537.3 (KHTML, like Gecko) SamsungBrowser/1.0 Mobile Safari/537.3",
    source: SRC.samsung, browser: "Samsung Internet", os: "Tizen", device: "mobile",
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.771 YaBrowser/23.11.2.771 Yowser/2.5 Safari/537.36",
    source: SRC.uap, browser: "Yandex", version: "23.11.2.771", os: "Windows", arch: "amd64",
  },
  {
    ua: "Mozilla/5.0 (Linux; arm_64; Android 13; 23053RN02Y) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.98 YaBrowser/23.11.5.98.00 SA/3 Mobile Safari/537.36",
    source: SRC.uap, browser: "Yandex", os: "Android", osVersion: "13", vendor: "Xiaomi", model: "23053RN02Y", arch: "arm64",
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36 Vivaldi/3.7",
    source: SRC.uap, browser: "Vivaldi", version: "3.7", os: "macOS", osVersion: "11.3", arch: undefined, frozen: ["cpu.architecture"],
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 7.1.2; Nexus 6P Build/WHALE) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.220 Whale/1.3.50.3 Mobile Safari/537.36",
    source: SRC.uap, browser: "Whale", version: "1.3.50.3", model: "Nexus 6P",
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 16; en-US; SM-S918B Build/BP2A.250605.031.A3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.80 UCMobile/15.0.7.1383 Mobile Safari/537.36",
    source: SRC.uap, browser: "UC Browser", version: "15.0.7.1383", osVersion: "16", vendor: "Samsung", model: "SM-S918B",
  },
  {
    ua: "Mozilla/5.0 (Linux; U; Android 6.0.1; ru-ru; Redmi 4 Build/MMB29M) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/61.0.3163.128 Mobile Safari/537.36 XiaoMi/MiuiBrowser/10.3.6-g",
    source: SRC.uap, browser: "MIUI Browser", version: "10.3.6", vendor: "Xiaomi", model: "Redmi 4",
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 13; LGE-AN00; HMSCore 6.12.2.302) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/14.0.5.301 Mobile Safari/537.36",
    source: SRC.uap, browser: "Huawei Browser", version: "14.0.5.301", model: "LGE-AN00",
  },
  {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1 Ddg/17.2",
    source: SRC.uap, browser: "DuckDuckGo", version: "17.2", os: "iOS", osVersion: "17.2.1",
  },
  {
    ua: "Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/36.6.0.9.50.692136875 Chrome/130.0.6723.191 VR Safari/537.36",
    source: SRC.uap, browser: "Oculus Browser", os: "Android", device: "xr", vendor: "Meta", model: "Quest 3", arch: undefined,
  },
  // ---------------------------------------------------------------- Brave (UA usually identical to Chrome)
  {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1 Brave",
    source: SRC.uap, browser: "Brave", os: "iOS", osVersion: "18.7", device: "mobile",
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.4472.124 Safari/537.3 brave/5035",
    source: SRC.uap, browser: "Brave", os: "Windows",
  },
  // ---------------------------------------------------------------- Firefox
  {
    ua: "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0",
    source: SRC.mdnUa, browser: "Firefox", version: "47.0", engine: "Gecko", os: "Windows", osVersion: "7", device: "desktop", arch: "amd64",
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:138.0) Gecko/20100101 Firefox/138.0",
    source: SRC.mdnSniffing, browser: "Firefox", version: "138.0", os: "macOS", osVersion: undefined, frozen: ["os.version", "cpu.architecture"],
  },
  {
    ua: "Mozilla/5.0 (Android 15; Mobile; rv:136.0) Gecko/136.0 Firefox/136.0",
    source: SRC.mdnSniffing, browser: "Firefox", version: "136.0", os: "Android", osVersion: "15", device: "mobile", model: undefined,
  },
  {
    ua: "Mozilla/5.0 (Android 4.4; Tablet; rv:41.0) Gecko/41.0 Firefox/41.0",
    source: SRC.mdnFirefox, browser: "Firefox", os: "Android", osVersion: "4.4", device: "tablet",
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 7.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Focus/1.0 Chrome/59.0.3029.83 Mobile Safari/537.36",
    source: SRC.mdnFirefox, browser: "Firefox Focus", version: "1.0", os: "Android", osVersion: "7.0", device: "mobile",
  },
  {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 12_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/7.0.4 Mobile/16B91 Safari/605.1.15",
    source: SRC.mdnFirefox, browser: "Firefox", version: "7.0.4", engine: "WebKit", os: "iOS", osVersion: "12.1", device: "mobile",
  },
  {
    ua: "Mozilla/5.0 (iPod touch; CPU iPhone OS 8_3 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) FxiOS/1.0 Mobile/12F69 Safari/600.1.4",
    source: SRC.mdnFirefox, browser: "Firefox", os: "iOS", osVersion: "8.3", device: "mobile", model: "iPod",
  },
  {
    ua: "Mozilla/5.0 (Mobile; rv:15.0) Gecko/15.0 Firefox/15.0",
    source: SRC.mdnFirefox, browser: "Firefox", device: "mobile", os: undefined,
  },
  // ---------------------------------------------------------------- Safari (incl. frozen OS versions)
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
    source: SRC.mdnUa, browser: "Safari", version: "26.0", engine: "WebKit", os: "macOS", osVersion: undefined, device: "desktop",
    frozen: ["os.version", "cpu.architecture"], label: "Safari 26 / macOS / desktop",
  },
  {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
    source: SRC.mdnUa, browser: "Mobile Safari", version: "26.0", os: "iOS", osVersion: undefined, device: "mobile", vendor: "Apple",
    model: "iPhone", frozen: ["os.version"], label: "Mobile Safari 26 / iOS / mobile",
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1 Safari/605.1.15",
    source: SRC.mdnFirefox, browser: "Safari", version: "13.1", os: "macOS", osVersion: "10.15.4",
  },
  {
    ua: "Mozilla/5.0 (iPad; U; CPU OS 4_3_2 like Mac OS X; en-us) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8H7 Safari",
    source: SRC.uap, browser: "Mobile Safari", version: "5.0.2", os: "iOS", osVersion: "4.3.2", device: "tablet", model: "iPad",
  },
  {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 7_1_2 like Mac OS X) AppleWebKit/537.51.2 (KHTML, like Gecko) Mobile/11D257",
    source: SRC.uap, browser: "WKWebView", webview: true, os: "iOS", osVersion: "7.1.2",
  },
  // ---------------------------------------------------------------- Chrome on iOS, WebViews
  {
    ua: "Mozilla/5.0 (iPad; U; CPU OS 5_1_1 like Mac OS X; en-us) AppleWebKit/534.46.0 (KHTML, like Gecko) Chrome/19.0.1084.60 Mobile/9B206 Safari/7534.48.3",
    source: SRC.uap, browser: "Chrome Mobile", engine: "WebKit", os: "iOS", device: "tablet",
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 7.1.2; Nexus 5X Build/N2G47W; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/58.0.3029.83 Mobile Safari/537.36",
    source: SRC.uap, browser: "Chrome WebView", version: "58.0.3029.83", webview: true, os: "Android", osVersion: "7.1.2", model: "Nexus 5X",
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 4.4.4; SHV31 Build/S2280) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/33.0.0.0 Mobile Safari/537.36",
    source: SRC.uap, browser: "Chrome WebView", version: undefined, major: "33", reduced: false, frozen: ["browser.version"], vendor: undefined, model: "SHV31",
  },
  // ---------------------------------------------------------------- In-app browsers
  {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 11_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15G77 [FBAN/FBIOS;FBAV/194.0.0.38.99;FBBV/127868476;FBDV/iPhone7,2;FBMD/iPhone;FBSN/iOS;FBSV/11.4.1;FBSS/2;FBCR/OrangeBotswana;FBID/phone;FBLC/en_GB;FBOP/5;FBRV/128807018]",
    source: SRC.uap, browser: "Facebook", version: "194.0.0.38.99", inApp: true, webview: true, os: "iOS", osVersion: "11.4.1",
  },
  {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 11_2_5 like Mac OS X) AppleWebKit/604.5.6 (KHTML, like Gecko) Mobile/15D60 Instagram 33.0.0.11.96 (iPhone9,3; iOS 11_2_5; en_AU; en-AU; scale=2.00; gamut=wide; 750x1334)",
    source: SRC.uap, browser: "Instagram", version: "33.0.0.11.96", inApp: true, os: "iOS", osVersion: "11.2.5",
  },
  {
    ua: "Instagram 416.0.0.47.66 Android (36/16; 306dpi; 1008x2244; Google/google; Pixel 9 Pro XL; komodo; komodo; en_US; 879745420)",
    source: SRC.uap, browser: "Instagram", os: "Android", osVersion: "16", device: "mobile", vendor: "Google", model: "Pixel 9 Pro XL",
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 10; moto g(7) Build/QP6_S30.52-23-13-4; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/108.0.5359.128 Mobile Safari/537.36 musical_ly_2022704050 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/27.4.5 ByteLocale/en ByteFullLocale/en Region/US Spark/1.2.4-alpha.5 AppVersion/27.4.5 PIA/1.5.10 BytedanceWebview/d8a21c6",
    source: SRC.uap, browser: "TikTok", version: "27.4.5", inApp: true, os: "Android", osVersion: "10", vendor: "Motorola", model: "moto g(7)",
  },
  {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BytedanceWebview/d8a21c6 trill_34.9.0 JsSdk/2.0 NetType/4G Channel/App Store ByteLocale/en Region/MY FalconTag/31CFA6E0-CAE5-4ECF-A13A-ADFCAFC2428F",
    source: SRC.uap, browser: "TikTok", version: "34.9.0", os: "iOS",
  },
  {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.2698",
    source: SRC.userAgentsNet, browser: "LinkedIn", version: "9.30.2698", inApp: true, os: "iOS", osVersion: "17.6.1",
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 5.1; FTJ152B Build/LMY47D; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/51.0.2704.81 Mobile Safari/537.36 Line/6.4.1",
    source: SRC.uap, browser: "Line", version: "6.4.1", inApp: true, os: "Android",
  },
  // ---------------------------------------------------------------- Legacy IE, consoles, TV, misc
  {
    ua: "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.1; Trident/5.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C; .NET4.0E; InfoPath.2)",
    source: SRC.uap, browser: "IE", version: "7.0", engine: "Trident", os: "Windows", osVersion: "7", device: "desktop",
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_4) AppleWebKit/537.36 (KHTML, like Gecko) pagedraw/0.1.0 Chrome/49.0.2623.75 Electron/0.37.8 Safari/537.36",
    source: SRC.uap, browser: "Electron", version: "0.37.8", os: "macOS", osVersion: "10.11.4",
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/534.34 (KHTML, like Gecko) PhantomJS/1.6.0 Safari/534.34",
    source: SRC.uap, browser: "PhantomJS", version: "1.6.0", device: "bot",
  },
  {
    ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36",
    source: SRC.captured, browser: "Headless Chrome", major: "154", os: "Linux", device: "bot", reduced: true,
  },
  {
    ua: "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.41 (KHTML, like Gecko) Large Screen WebAppManager Safari/537.41",
    source: SRC.uap, os: "webOS", device: "tv",
  },
];
