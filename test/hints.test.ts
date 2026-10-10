import { describe, expect, it } from "vitest";
import { isGreaseBrand, parse, parseHeaders } from "../src/index.js";
import { hintPlatformVersion, readHints } from "../src/hints.js";

// Sources (retrieved 2026-10-10):
const SPEC = "https://wicg.github.io/ua-client-hints/"; // §1.1 example
const CHROME_DOC = "https://developer.chrome.com/docs/privacy-security/user-agent-client-hints";
const BRAVE_ISSUE = "https://github.com/rustfs/rustfs/issues/2457"; // Caddy log of a real Brave 146 request
// Captured from google-chrome 154 --headless=new against a local server (Accept-CH for all hints).
const HEADLESS_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36";
const HEADLESS_HEADERS = {
  "user-agent": HEADLESS_UA,
  "sec-ch-ua": '"Chromium";v="154", "Google Chrome";v="154", "Not A(Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-arch": '"x86"',
  "sec-ch-ua-platform": '"Linux"',
  "sec-ch-ua-platform-version": '""',
  "sec-ch-ua-model": '""',
  "sec-ch-ua-bitness": '"64"',
  "sec-ch-ua-wow64": "?0",
  "sec-ch-ua-full-version-list": '"Chromium";v="154.0.8037.57", "Google Chrome";v="154.0.8037.57", "Not A(Brand";v="99.0.0.0"',
  "sec-ch-ua-form-factors": '"Desktop"',
};
// Same browser, navigator.userAgentData.getHighEntropyValues([...]) output.
const HEADLESS_UADATA = {
  architecture: "x86",
  bitness: "64",
  brands: [
    { brand: "Chromium", version: "154" },
    { brand: "Google Chrome", version: "154" },
    { brand: "Not A(Brand", version: "99" },
  ],
  formFactors: ["Desktop"],
  fullVersionList: [
    { brand: "Chromium", version: "154.0.8037.57" },
    { brand: "Google Chrome", version: "154.0.8037.57" },
    { brand: "Not A(Brand", version: "99.0.0.0" },
  ],
  mobile: false,
  model: "",
  platform: "Linux",
  platformVersion: "",
  wow64: false,
};
const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"; // MDN
const CHROME_ANDROID_K = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36"; // MDN

describe("Client Hints — spec and Chromium examples", () => {
  it(`spec example (${SPEC}): GREASE brand dropped, Windows platform version 14 → Windows 11`, () => {
    const r = parse("", {
      hints: {
        "Sec-CH-UA": '"Examplary Browser"; v="73", ";Not?A.Brand"; v="27"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
        "Sec-CH-UA-Platform-Version": '"14.0.0"',
      },
    });
    expect(r.hints).toEqual({
      used: true,
      applied: ["os.name", "os.version", "device.type"],
      invalid: [],
      brands: [{ brand: "Examplary Browser", version: "73" }],
    });
    expect(r.os).toMatchObject({ name: "Windows", version: "11", family: "windows" });
    expect(r.device.type).toBe("desktop");
    expect(r.browser.name).toBeUndefined(); // unknown brand
  });

  it(`Chrome docs desktop example (${CHROME_DOC})`, () => {
    const r = parse("", {
      hints: {
        "sec-ch-ua": '"Chromium";v="93", "Google Chrome";v="93", " Not;A Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
      },
    });
    expect(r.browser).toMatchObject({ name: "Chrome", version: undefined, major: "93" });
    expect(r.os.name).toBe("macOS");
    expect(r.hints.brands).toEqual([
      { brand: "Chromium", version: "93" },
      { brand: "Google Chrome", version: "93" },
    ]);
  });

  it("Chrome docs Android example with the full version list", () => {
    const r = parse(CHROME_ANDROID_K, {
      hints: {
        "sec-ch-ua": '" Not A;Brand";v="99", "Chromium";v="98", "Google Chrome";v="98"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-full-version-list": '" Not A;Brand";v="99.0.0.0", "Chromium";v="98.0.4738.0", "Google Chrome";v="98.0.4738.0"',
        "sec-ch-ua-platform": '"Android"',
      },
    });
    expect(r.browser).toMatchObject({ name: "Chrome Mobile", version: "98.0.4738.0", major: "98", engine: { name: "Blink", version: "98.0.4738.0" } });
    // Platform version and model were not sent, so those stay frozen.
    expect(r.frozen).toEqual(["os.version", "device.model"]);
    expect(r.hints.applied).toEqual(["browser.version", "browser.engine"]);
  });

  it("captured headless Chrome request headers resolve every reduced field", () => {
    const r = parseHeaders(HEADLESS_HEADERS);
    expect(r.browser).toMatchObject({ name: "Headless Chrome", version: "154.0.8037.57", major: "154" });
    expect(r.cpu.architecture).toBe("amd64");
    expect(r.os.name).toBe("Linux");
    expect(r.frozen).toEqual([]);
    expect(r.device.type).toBe("bot");
    expect(r.bot.category).toBe("headless-browser");
  });

  it("navigator.userAgentData values give the same answer as the headers", () => {
    const a = parseHeaders(HEADLESS_HEADERS);
    const b = parse(HEADLESS_UA, { hints: HEADLESS_UADATA });
    expect(b.browser).toEqual(a.browser);
    expect(b.cpu).toEqual(a.cpu);
    expect(b.os).toEqual(a.os);
    expect(b.hints.brands).toEqual(a.hints.brands);
  });

  it("a Fetch Headers object works too", () => {
    const h = new Headers(HEADLESS_HEADERS);
    expect(parseHeaders(h).browser.version).toBe("154.0.8037.57");
    expect(parse(HEADLESS_UA, { hints: h }).cpu.architecture).toBe("amd64");
  });

  it(`Brave: UA identical to Chrome, only the hint brand differs (${BRAVE_ISSUE})`, () => {
    // Caddy logs header values as arrays.
    const headers = {
      "Sec-Ch-Ua-Platform": ['"Linux"'],
      "Sec-Ch-Ua-Mobile": ["?0"],
      "User-Agent": ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"],
      "Sec-Ch-Ua": ['"Chromium";v="146", "Not-A.Brand";v="24", "Brave";v="146"'],
    };
    expect(parse(headers["User-Agent"][0]).browser.name).toBe("Chrome");
    const r = parseHeaders(headers);
    expect(r.browser).toMatchObject({ name: "Brave", major: "146", version: undefined });
    expect(r.frozen).toEqual(["browser.version", "cpu.architecture"]);
    expect(r.hints.brands).toEqual([
      { brand: "Chromium", version: "146" },
      { brand: "Brave", version: "146" },
    ]);
  });
});

// The remaining blocks use synthetic hint values to exercise the mapping rules;
// the real-world examples are all in the block above.
describe("Client Hints — reduced UA overrides", () => {
  it("Windows 11 is only knowable from Sec-CH-UA-Platform-Version", () => {
    const base = parse(CHROME_WIN);
    expect(base.os.version).toBeUndefined();
    const win11 = parse(CHROME_WIN, { hints: { "sec-ch-ua-platform": '"Windows"', "sec-ch-ua-platform-version": '"15.0.0"' } });
    expect(win11.os).toMatchObject({ version: "11", reportedVersion: "10.0" });
    const win10 = parse(CHROME_WIN, { hints: { "sec-ch-ua-platform-version": '"10.0.0"' } });
    expect(win10.os.version).toBe("10");
    expect(win10.frozen).not.toContain("os.version");
  });

  it("model, platform version, architecture and full version replace the frozen values", () => {
    const r = parse(CHROME_ANDROID_K, {
      hints: {
        "sec-ch-ua-model": '"Pixel 9"',
        "sec-ch-ua-platform": '"Android"',
        "sec-ch-ua-platform-version": '"16.0.0"',
        "sec-ch-ua-full-version-list": '"Google Chrome";v="143.0.7499.40", "Chromium";v="143.0.7499.40", "Not)A;Brand";v="8.0.0.0"',
      },
    });
    expect(r.device).toMatchObject({ model: "Pixel 9", vendor: "Google", reportedModel: "K" });
    expect(r.os.version).toBe("16");
    expect(r.browser.version).toBe("143.0.7499.40");
    expect(r.frozen).toEqual([]);
    expect(r.confidence).toBe("high");
  });

  it("maps Sec-CH-UA-Arch / Bitness", () => {
    const arch = (a: string, b?: string) =>
      parse(CHROME_WIN, { hints: { "sec-ch-ua-arch": `"${a}"`, ...(b === undefined ? {} : { "sec-ch-ua-bitness": `"${b}"` }) } }).cpu.architecture;
    expect(arch("x86", "64")).toBe("amd64");
    expect(arch("x86", "32")).toBe("ia32");
    expect(arch("x86")).toBe("x86");
    expect(arch("arm", "64")).toBe("arm64");
    expect(arch("arm")).toBe("arm");
    expect(arch("sparc")).toBeUndefined();
  });

  it("maps form factors and the mobile hint", () => {
    const ff = (list: string) => parse("", { hints: { "sec-ch-ua-form-factors": list } }).device.type;
    expect(ff('"XR"')).toBe("xr");
    expect(ff('"Watch", "Mobile"')).toBe("wearable");
    expect(ff('"Automotive"')).toBe("embedded");
    expect(ff('"Tablet", "Desktop"')).toBe("tablet");
    expect(ff('"Mobile"')).toBe("mobile");
    expect(ff('"EInk"')).toBe("embedded");
    expect(ff('"Desktop"')).toBe("desktop");
    expect(ff('"Toaster"')).toBe("unknown");
    expect(parse("", { hints: { "sec-ch-ua-mobile": "?1" } }).device.type).toBe("mobile");
    expect(parse("", { hints: { "sec-ch-ua-mobile": "?0" } }).device.type).toBe("unknown");
    expect(parse("", { hints: { "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Linux"' } }).device.type).toBe("desktop");
  });

  it("prefers a specific brand over Chromium and keeps the UA's mobile variant", () => {
    const edge = parse(CHROME_WIN, {
      hints: { "sec-ch-ua-full-version-list": '"Chromium";v="143.0.3650.66", "Microsoft Edge";v="143.0.3650.66", "Not A(Brand";v="24.0.0.0"' },
    });
    expect(edge.browser).toMatchObject({ name: "Edge", version: "143.0.3650.66" });
    const chromiumOnly = parse(CHROME_ANDROID_K, { hints: { "sec-ch-ua": '"Chromium";v="143"' } });
    expect(chromiumOnly.browser.name).toBe("Chrome Mobile");
    expect(parse("", { hints: { "sec-ch-ua": '"Chromium";v="143"' } }).browser.name).toBe("Chromium");
    expect(parse("", { hints: { "sec-ch-ua": '"Google Chrome";v="143"', "sec-ch-ua-mobile": "?1" } }).browser.name).toBe("Chrome Mobile");
    expect(parse("", { hints: { "sec-ch-ua": '"Android WebView";v="143"' } }).browser).toMatchObject({ name: "Chrome WebView", webview: true });
  });

  it("does not take a placeholder full version from hints", () => {
    const r = parse(CHROME_WIN, { hints: { "sec-ch-ua-full-version-list": '"Google Chrome";v="143.0.0.0"' } });
    expect(r.browser.version).toBeUndefined();
    expect(r.frozen).toContain("browser.version");
  });

  it("macOS / Android platform versions drop trailing zero components", () => {
    expect(hintPlatformVersion("macOS", "15.1.0")).toBe("15.1");
    expect(hintPlatformVersion("Android", "14.0.0")).toBe("14");
    expect(hintPlatformVersion("Windows", "0.1.0")).toBe("7");
    expect(hintPlatformVersion("Windows", "0.2.0")).toBe("8");
    expect(hintPlatformVersion("Windows", "0.3.0")).toBe("8.1");
    expect(hintPlatformVersion("Windows", "0.0.0")).toBeUndefined();
    expect(hintPlatformVersion("Windows", "11.0.0")).toBeUndefined();
    expect(hintPlatformVersion("Windows", "13.0.0")).toBe("11");
    expect(hintPlatformVersion("Windows", "abc")).toBeUndefined();
    expect(hintPlatformVersion(undefined, "6.1")).toBe("6.1");
  });
});

describe("Client Hints — validation", () => {
  it("ignores and reports malformed headers instead of throwing", () => {
    const r = parse(CHROME_WIN, {
      hints: {
        "sec-ch-ua": '"Chromium";v=143', // v must be a string
        "sec-ch-ua-mobile": "1", // not an sf-boolean
        "sec-ch-ua-platform": "Windows", // token, not a string
        "sec-ch-ua-model": '"unterminated',
        "sec-ch-ua-form-factors": "(\"Desktop\")", // inner list
        "sec-ch-ua-full-version-list": '"Chromium"', // missing v
      },
    });
    expect(r.hints.used).toBe(false);
    expect(r.hints.invalid.sort()).toEqual(
      ["sec-ch-ua", "sec-ch-ua-form-factors", "sec-ch-ua-full-version-list", "sec-ch-ua-mobile", "sec-ch-ua-model", "sec-ch-ua-platform"].sort(),
    );
    expect(r.os.version).toBeUndefined();
  });

  it("caps hint values at maxLength", () => {
    const long = `"${"a".repeat(3000)}"`;
    expect(parse("", { hints: { "sec-ch-ua-model": long } }).hints.invalid).toEqual(["sec-ch-ua-model"]);
    expect(parse("", { hints: { "sec-ch-ua-model": long }, maxLength: 4000 }).device.model).toBe("a".repeat(3000));
    expect(parse("", { hints: { model: "a".repeat(3000) } }).hints.invalid).toEqual(["model"]);
  });

  it("validates navigator.userAgentData values", () => {
    const r = parse("", {
      hints: {
        brands: [{ brand: "Google Chrome" }],
        fullVersionList: "nope",
        mobile: "yes",
        platform: 7,
        formFactors: ["Desktop", 3],
        architecture: undefined,
      } as never,
    });
    expect(r.hints.invalid.sort()).toEqual(["brands", "formFactors", "fullVersionList", "mobile", "platform"]);
    expect(parse("", { hints: { brands: [null] } as never }).hints.invalid).toEqual(["brands"]);
    expect(parse("", { hints: { brands: [{ brand: "x".repeat(3000), version: "1" }] } }).hints.invalid).toEqual(["brands"]);
  });

  it("combines repeated header lines and rejects non-string values", () => {
    const r = parse("", { hints: { "sec-ch-ua": ['"Chromium";v="1"', '"Google Chrome";v="1"'] } });
    expect(r.browser.name).toBe("Chrome");
    expect(parse("", { hints: { "sec-ch-ua": 5 } as never }).hints.invalid).toEqual(["sec-ch-ua"]);
    expect(parse("", { hints: { "sec-ch-ua": [5] } as never }).hints.invalid).toEqual(["sec-ch-ua"]);
  });

  it("header names are case-insensitive and the first spelling wins", () => {
    const r = readHints({ "SEC-CH-UA-PLATFORM": '"Android"', "sec-ch-ua-platform": '"Windows"' }, 2048);
    expect(r.platform).toBe("Android");
  });

  it("rejects non-object hints", () => {
    expect(() => parse("", { hints: "x" as never })).toThrow(/hints must be/);
    expect(() => parse("", { hints: [] as never })).toThrow(/hints must be/);
    expect(parse("", { hints: null as never }).hints.used).toBe(false);
  });
});

describe("GREASE", () => {
  it("recognises Chromium's and the spec's GREASE brands", () => {
    for (const b of [
      "Not A(Brand",
      " Not;A Brand",
      " Not A;Brand",
      "Not)A;Brand",
      "Not/A)Brand",
      "Not_A Brand",
      "Not-A.Brand",
      ";Not?A.Brand",
      "Not.A/Brand",
      "(Not(A:Brand",
      "Not=A?Brand",
    ]) {
      expect(isGreaseBrand(b), b).toBe(true);
    }
  });

  it("keeps real brands", () => {
    for (const b of ["Google Chrome", "Chromium", "Microsoft Edge", "Samsung Internet", "Opera GX", "Brave", "Examplary Browser", "Microsoft Edge WebView2"]) {
      expect(isGreaseBrand(b), b).toBe(false);
    }
  });
});
