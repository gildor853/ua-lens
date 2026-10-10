import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_MAX_LENGTH, UaLensError, detectBot, isUaLensError, normalize, parse, parseHeaders } from "../src/index.js";

const corpus = JSON.parse(readFileSync(join(__dirname, "fixtures/uap-core/corpus.json"), "utf8")) as { ua: string }[];

describe("input validation", () => {
  it("accepts strings, null and undefined", () => {
    expect(parse(null).ua).toBe("");
    expect(parse(undefined).browser.name).toBeUndefined();
    expect(parse("").confidence).toBe("low");
  });

  it("rejects other types with a typed error", () => {
    for (const bad of [1, {}, [], true, Symbol("x"), () => "ua", new String("Mozilla")]) {
      let err: unknown;
      try {
        parse(bad as never);
      } catch (e) {
        err = e;
      }
      expect(isUaLensError(err), String(typeof bad)).toBe(true);
      expect((err as UaLensError).code).toBe("InvalidInput");
    }
    expect(() => detectBot(42 as never)).toThrow(UaLensError);
    expect(isUaLensError(new Error("x"))).toBe(false);
  });

  it("validates options", () => {
    for (const maxLength of [0, -1, 1.5, Number.NaN, Infinity, 1_000_001, "10"]) {
      expect(() => parse("x", { maxLength: maxLength as never }), String(maxLength)).toThrow(/maxLength/);
    }
    expect(() => parse("x", 5 as never)).toThrow(/options/);
    expect(() => parse("x", null as never)).not.toThrow();
    expect(() => parse("x", { hints: undefined })).not.toThrow();
  });

  it("truncates long input at the default or configured length", () => {
    const long = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 " + "x".repeat(5000);
    const r = parse(long);
    expect(r.truncated).toBe(true);
    expect(r.ua.length).toBe(DEFAULT_MAX_LENGTH);
    expect(r.browser.name).toBe("Chrome");
    const short = parse(long, { maxLength: 20 });
    expect(short).toMatchObject({ truncated: true, ua: "Mozilla/5.0 (Windows" });
    expect(parse("short").truncated).toBe(false);
    expect(parse(long, { maxLength: 10_000 }).truncated).toBe(false);
  });
});

describe("prototype pollution", () => {
  it("ignores __proto__ / constructor keys in header records and hints", () => {
    const headers = JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"prototype": {"polluted": true}}, "user-agent": "__proto__", "sec-ch-ua": "\\"__proto__\\";v=\\"1\\""}');
    const r = parseHeaders(headers);
    expect(r.ua).toBe("__proto__");
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty("polluted");
    const h = JSON.parse('{"__proto__": {"platform": "Windows"}, "brands": [{"brand": "__proto__", "version": "1"}]}');
    expect(parse("Mozilla/5.0", { hints: h }).os.name).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty("platform");
  });

  it("returns plain data objects for hostile UA strings", () => {
    for (const ua of ["__proto__", "constructor", "prototype", "toString", "hasOwnProperty", "__proto__/1.0 (constructor; prototype)"]) {
      const r = parse(ua);
      expect(r.browser.name, ua).toBeUndefined();
      expect(r.os.name, ua).toBeUndefined();
      expect(normalize(ua).id, ua).toBe(r.bot.isBot ? normalize(ua).id : "unknown:unknown:unknown");
    }
    expect(Object.prototype).not.toHaveProperty("polluted");
  });

  it("ignores inherited keys on hint objects", () => {
    const proto = { platform: "Windows", "sec-ch-ua-platform": '"Windows"' };
    const hints = Object.create(proto) as object;
    expect(parse("Mozilla/5.0", { hints }).os.name).toBeUndefined();
  });
});

describe("uap-core corpus", () => {
  it(`parses all ${corpus.length} real-world UAs without throwing, deterministically`, () => {
    expect(corpus.length).toBeGreaterThan(15_000);
    for (const { ua } of corpus) {
      const a = parse(ua);
      expect(a.ua).toBe(ua.slice(0, DEFAULT_MAX_LENGTH));
      expect(["high", "medium", "low"]).toContain(a.confidence);
    }
    const sample = corpus.filter((_, i) => i % 97 === 0);
    for (const { ua } of sample) expect(parse(ua)).toEqual(parse(ua));
  });

  it("results are JSON-serialisable", () => {
    for (const { ua } of corpus.filter((_, i) => i % 500 === 0)) {
      const r = parse(ua);
      expect(JSON.parse(JSON.stringify(r))).toEqual(JSON.parse(JSON.stringify(r)));
      expect(Object.getPrototypeOf(r)).toBe(Object.prototype);
    }
  });
});
