import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectBot, parse } from "../src/index.js";

const corpus = (JSON.parse(readFileSync(join(__dirname, "fixtures/uap-core/corpus.json"), "utf8")) as { ua: string }[]).map((e) => e.ua);

describe("performance", () => {
  it("parses 100,000 real UAs in a few seconds", () => {
    // Generous ceiling for slow CI runners; locally this takes roughly 2–3 s.
    const t = performance.now();
    for (let i = 0; i < 100_000; i++) parse(corpus[i % corpus.length]!);
    const ms = performance.now() - t;
    console.info(`100k parse(): ${ms.toFixed(0)} ms (${((ms * 1000) / 100_000).toFixed(1)} µs/UA)`);
    expect(ms).toBeLessThan(20_000);
  });

  it("detectBot alone is cheaper than a full parse", () => {
    const t = performance.now();
    for (let i = 0; i < 100_000; i++) detectBot(corpus[i % corpus.length]!);
    const ms = performance.now() - t;
    console.info(`100k detectBot(): ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(10_000);
  });
});
