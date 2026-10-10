import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as rules from "../src/data/rules.js";
import { BOT_DEFINITIONS } from "../src/data/bots.js";
import { GENERIC_URL, GENERIC_WORD } from "../src/bots.js";
import { detectBot, parse, parseSfList, type ClientHintsInput } from "../src/index.js";
import { auditRegex, collectRegexes } from "./regex-audit.js";

/** Regex literals that appear inline in the source files (crude but sufficient for this code base). */
function inlineRegexes(): RegExp[] {
  const dir = join(__dirname, "../src");
  const files = [...readdirSync(dir).map((f) => join(dir, f)), ...readdirSync(join(dir, "data")).map((f) => join(dir, "data", f))].filter((f) => f.endsWith(".ts"));
  const literal = /(?<=[=(,:!&|?[]\s{0,4})\/(?![*/])((?:\\.|\[(?:\\.|[^\]\\])*\]|[^/\n\\[])+)\/([dgimsuvy]*)/g;
  const out: RegExp[] = [];
  for (const f of files) {
    // Drop comments first so prose such as `Token/<version>` is not mistaken for a literal.
    const text = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/`[^`]*`/g, "``");
    for (const m of text.matchAll(literal)) out.push(new RegExp(m[1]!, m[2]!.replace("g", "")));
  }
  return out;
}

describe("ReDoS heuristic", () => {
  it("flags the classic catastrophic shapes (self-test)", () => {
    for (const bad of [/(a+)+$/, /(a|aa)*b/, /.*x/, /^(\w+\s?)*$/, /(?:\d{1,5}){1,100}/, /(a|b){1,50}/, /x{1,5000}/, /[^)]+\)/]) {
      expect(auditRegex(bad).length, bad.source).toBeGreaterThan(0);
    }
    for (const ok of [/\bChrome\/(\d{1,4})((?:\.\d{1,10}){0,3})/, /[^)]{1,400}/, /(?:a|b)?c/]) {
      expect(auditRegex(ok), ok.source).toEqual([]);
    }
  });

  it("finds a meaningful number of regexes to audit", () => {
    expect(collectRegexes([rules, BOT_DEFINITIONS]).length).toBeGreaterThan(200);
    expect(inlineRegexes().length).toBeGreaterThan(20);
  });

  it("every rule, bot pattern and inline regex is bounded and free of nested repetition", () => {
    const all = [...collectRegexes([rules, BOT_DEFINITIONS, GENERIC_URL, GENERIC_WORD]), ...inlineRegexes()];
    const issues = all.flatMap(auditRegex);
    expect(issues).toEqual([]);
  });
});

/** Deterministic PRNG so failures are reproducible. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0;
    return s / 2 ** 32;
  };
}

describe("fuzz timing (adversarial 2048-char inputs)", () => {
  const pieces = [
    "Mozilla/5.0 (", "(", ")", ";", " ", "/", ".", "1", "9", "Chrome/", "Version/", "Safari/", "AppleWebKit/",
    "Android ", "Linux; ", "Build/", "rv:", "Gecko/", "Windows NT ", "iPhone OS ", "_", "like Mac OS X", "bot", "crawler",
    "http://", "compatible; ", "Edg/", "OPR/", "wv", "Mobile", "SM-", "a", "-", "+", "\"", "=", ",", "?1", "Brand",
  ];
  const ADVERSARIAL = [
    "(".repeat(2048), ")".repeat(2048), "Mozilla/5.0 (" + "a; ".repeat(700), "Chrome/" + "1.".repeat(1020),
    "Android " + "1".repeat(2040), "bot".repeat(682), "a".repeat(2047) + "!", "Mozilla/5.0 (Linux; Android 10; " + " ".repeat(2000),
    "Version/4.0 " + "Safari/1 ".repeat(225), "http://".repeat(292), "_".repeat(2048), "rv:" + "1.".repeat(1020),
    "Mozilla/5.0 (iPhone; CPU iPhone OS " + "1_".repeat(1000),
  ];

  it("random and pathological UAs each parse in well under 50 ms", () => {
    const rand = rng(0x5eed);
    const inputs = [...ADVERSARIAL];
    for (let n = 0; n < 300; n++) {
      let s = "";
      while (s.length < 2048) s += pieces[Math.floor(rand() * pieces.length)]!;
      inputs.push(s.slice(0, 2048));
    }
    let worst = 0;
    for (const ua of inputs) {
      const t = performance.now();
      parse(ua);
      detectBot(ua);
      worst = Math.max(worst, performance.now() - t);
    }
    expect(worst).toBeLessThan(50);
  });

  it("hostile Client Hints headers stay fast", () => {
    const hostile: ClientHintsInput[] = [
      { "sec-ch-ua": '"a";v="1", '.repeat(200) },
      { "sec-ch-ua": "\"".repeat(2048) },
      { "sec-ch-ua-full-version-list": ";".repeat(2048) },
      { "sec-ch-ua": "(".repeat(2048) },
      { "sec-ch-ua-platform-version": "1.".repeat(1024) },
    ];
    for (const hints of hostile) {
      const t = performance.now();
      parse("Mozilla/5.0", { hints });
      expect(performance.now() - t).toBeLessThan(50);
    }
    const t = performance.now();
    parseSfList("(" + "a ".repeat(4000) + ")");
    expect(performance.now() - t).toBeLessThan(50);
  });
});
