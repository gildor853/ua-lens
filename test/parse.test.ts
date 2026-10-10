import { describe, expect, it } from "vitest";
import { normalize, parse } from "../src/index.js";
import { CORPUS } from "./corpus.js";

describe("parse — real UA corpus", () => {
  it("every case cites a source", () => {
    for (const c of CORPUS) expect(c.source, c.ua).toMatch(/^(https:\/\/|captured)/);
  });

  for (const c of CORPUS) {
    it(c.ua.slice(0, 110), () => {
      const r = parse(c.ua);
      const got: Record<string, unknown> = {};
      const want: Record<string, unknown> = {};
      const check = (key: keyof typeof c, value: unknown) => {
        if (key in c) {
          got[key] = value;
          want[key] = c[key];
        }
      };
      check("browser", r.browser.name);
      check("version", r.browser.version);
      check("major", r.browser.major);
      check("engine", r.browser.engine.name);
      check("os", r.os.name);
      check("osVersion", r.os.version);
      check("device", r.device.type);
      check("vendor", r.device.vendor);
      check("model", r.device.model);
      check("arch", r.cpu.architecture);
      check("reduced", r.reduced);
      check("frozen", r.frozen);
      check("inApp", r.browser.inApp);
      check("webview", r.browser.webview);
      check("label", normalize(c.ua).label);
      expect(got).toEqual(want);
      expect(r.ua).toBe(c.ua);
    });
  }
});

describe("parse — result shape", () => {
  it("reports raw values next to trustworthy ones", () => {
    const r = parse("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36");
    expect(r.browser).toMatchObject({ version: undefined, major: "143", reportedVersion: "143.0.0.0" });
    expect(r.os).toMatchObject({ name: "Android", version: undefined, reportedVersion: "10", family: "android" });
    expect(r.device).toMatchObject({ model: undefined, reportedModel: "K" });
    expect(r.confidence).toBe("medium");
    expect(r.hints).toEqual({ used: false, applied: [], invalid: [], brands: [] });
  });

  it("confidence is high for an unfrozen browser UA and low for unknown agents", () => {
    expect(parse("Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0").confidence).toBe("high");
    expect(parse("curl/8.14.1").confidence).toBe("low");
    expect(parse("").confidence).toBe("low");
    // Browser identified but OS unknown → medium.
    expect(parse("Mozilla/5.0 (Mobile; rv:15.0) Gecko/15.0 Firefox/15.0").confidence).toBe("medium");
  });

  it("marks bots as device type bot and keeps the parsed browser", () => {
    const r = parse(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1 (Applebot/0.1; +http://www.apple.com/go/applebot)",
    );
    expect(r.device.type).toBe("bot");
    expect(r.bot).toMatchObject({ isBot: true, name: "Applebot", category: "search-engine" });
    expect(r.browser.name).toBe("Mobile Safari");
  });

  it("maps every documented Windows NT version", () => {
    const win = (nt: string) => parse(`Mozilla/5.0 (Windows NT ${nt}; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0`).os;
    expect(win("10.0")).toMatchObject({ version: undefined, reportedVersion: "10.0" });
    expect(win("6.3").version).toBe("8.1");
    expect(win("6.2").version).toBe("8");
    expect(win("6.1").version).toBe("7");
    expect(win("6.0").version).toBe("Vista");
    expect(win("5.1").version).toBe("XP");
    expect(win("5.2").version).toBe("XP");
    expect(win("5.0").version).toBe("2000");
    expect(win("6.4").version).toBeUndefined();
  });

  it("only treats iOS 18.6 / 18.6.2 / 18.7 as frozen when Safari reports version 26+", () => {
    const ios = (v: string, safari: string) =>
      parse(`Mozilla/5.0 (iPhone; CPU iPhone OS ${v} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${safari} Mobile/15E148 Safari/604.1`);
    expect(ios("18_6", "26.0").frozen).toEqual(["os.version"]);
    expect(ios("18_6_2", "26.1").frozen).toEqual(["os.version"]);
    expect(ios("18_7", "26.0").os.version).toBeUndefined();
    expect(ios("18_6", "18.6").os.version).toBe("18.6");
    expect(ios("18_5", "26.0").os.version).toBe("18.5");
  });
});
