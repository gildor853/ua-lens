import { describe, expect, it } from "vitest";
import { BOT_DEFINITIONS, ROBOTS_ONLY_TOKENS, detectBot, isAiBot, isBot, parse, verifyBotHints, type BotCategory } from "../src/index.js";
import { CORPUS } from "./corpus.js";

const AI: BotCategory[] = ["ai-crawler", "ai-assistant", "ai-search"];

describe("bot definitions data", () => {
  it("ids are unique and lowercase; tokens are lowercase", () => {
    const ids = BOT_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of BOT_DEFINITIONS) {
      expect(d.id, d.id).toMatch(/^[a-z0-9.-]+$/);
      expect(d.token, d.id).toBe(d.token.toLowerCase());
      expect(d.token.length, d.id).toBeGreaterThan(2);
    }
  });

  it("every entry cites a dated source, and every AI agent is sourced from operator documentation", () => {
    for (const d of BOT_DEFINITIONS) {
      expect(d.sources.length, d.id).toBeGreaterThan(0);
      for (const s of d.sources) {
        expect(s.url, d.id).toMatch(/^https:\/\//);
        expect(s.retrieved, d.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      if (AI.includes(d.category)) expect(d.sources.every((s) => s.kind === "operator"), d.id).toBe(true);
      expect(d.url, d.id).toMatch(/^https:\/\//);
    }
  });

  it("verification keys point into verifyBotHints", () => {
    for (const d of BOT_DEFINITIONS) if (d.verification !== undefined) expect(verifyBotHints[d.verification], d.id).toBeDefined();
    for (const [key, h] of Object.entries(verifyBotHints)) {
      expect(h.docs, key).toMatch(/^https:\/\//);
      for (const u of h.ipRanges) expect(u, key).toMatch(/^https:\/\//);
      for (const s of h.reverseDnsSuffixes) expect(s, key).toMatch(/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/);
      if (h.method === "reverse-dns") expect(h.reverseDnsSuffixes.length, key).toBeGreaterThan(0);
      if (h.method === "ip-ranges") expect(h.ipRanges.length, key).toBeGreaterThan(0);
      if (h.method === "none") expect(h.note, key).toBeDefined();
    }
  });

  it("data is frozen", () => {
    expect(Object.isFrozen(BOT_DEFINITIONS)).toBe(true);
    expect(Object.isFrozen(BOT_DEFINITIONS[0])).toBe(true);
    expect(Object.isFrozen(verifyBotHints)).toBe(true);
    expect(Object.isFrozen(ROBOTS_ONLY_TOKENS)).toBe(true);
  });

  it("does not include agents without current operator documentation", () => {
    for (const name of ["anthropic-ai", "Claude-Web", "FacebookBot", "cohere-ai", "Timpibot", "Bytespider", "TelegramBot"]) {
      expect(BOT_DEFINITIONS.some((d) => d.name.toLowerCase() === name.toLowerCase()), name).toBe(false);
    }
  });
});

describe("detectBot", () => {
  // Shadowing check: each documented example must be attributed to its own entry,
  // so a more general token earlier in the table can never swallow a specific one.
  for (const d of BOT_DEFINITIONS) {
    for (const ua of d.examples) {
      it(`${d.id}: ${ua.slice(0, 90)}`, () => {
        expect(ua.toLowerCase()).toContain(d.token);
        const r = detectBot(ua);
        expect(r).toMatchObject({ isBot: true, category: d.category, operator: d.operator, generic: false });
        if (d.id === "baiduspider") expect(r.name).toMatch(/^Baiduspider/);
        else expect(r.name).toBe(d.name);
        expect(r.respectsRobotsTxt).toBe(d.respectsRobotsTxt);
        expect(r.verification).toBe(d.verification);
      });
    }
  }

  it("extracts versions", () => {
    expect(detectBot("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot").version).toBe("1.4");
    expect(detectBot("Mozilla/5.0 (compatible; Baiduspider/2.0; + http://www.baidu.com/search/spider.html）")).toMatchObject({ name: "Baiduspider", version: "2.0" });
    expect(detectBot("Baiduspider-image").name).toBe("Baiduspider-image");
    expect(detectBot("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)").version).toBe("1.0");
    expect(detectBot("ClaudeBot").version).toBeUndefined();
  });

  it("does not flag real browsers from the corpus (except headless / PhantomJS)", () => {
    for (const c of CORPUS) {
      const expected = c.browser === "Headless Chrome" || c.browser === "PhantomJS";
      expect(detectBot(c.ua).isBot, c.ua).toBe(expected);
    }
  });

  it("robots.txt-only tokens never match as a product of their own", () => {
    for (const t of ROBOTS_ONLY_TOKENS) {
      const r = detectBot(t.token);
      expect(r.name === t.token, t.token).toBe(false);
    }
  });

  it("falls back to a generic heuristic", () => {
    expect(detectBot("MyCoolCrawler/1.0")).toMatchObject({ isBot: true, generic: true, category: "other", name: "MyCoolCrawler" });
    expect(detectBot("Mozilla/5.0 (compatible; ExampleSpider; )").name).toBe("ExampleSpider");
    expect(detectBot("something (+https://example.com/info)")).toMatchObject({ isBot: true, generic: true, name: undefined });
    // The phone brand "Cubot" is not a bot (real UA from uap-core test_device.yaml).
    expect(detectBot("Mozilla/5.0 (Linux; Android 4.2.2; CUBOT C11 Build/JDQ39) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.57 Mobile Safari/537.36 OPR/18.0.1290.66961").isBot).toBe(false);
    expect(detectBot("").isBot).toBe(false);
    expect(detectBot(undefined).isBot).toBe(false);
  });

  it("anchored library tokens do not match inside other UAs", () => {
    expect(detectBot("Mozilla/5.0 node").name).toBeUndefined();
    expect(detectBot("node").name).toBe("Node.js fetch");
    expect(detectBot("my-app curl/8.0").name).toBeUndefined();
    expect(detectBot("WhatsApp/2.22.20.72 A extra").name).toBeUndefined();
  });

  it("isBot / isAiBot helpers", () => {
    expect(isBot("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot")).toBe(true);
    expect(isAiBot("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot")).toBe(true);
    expect(isAiBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(false);
    expect(isAiBot("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)")).toBe(true);
    expect(isAiBot("CCBot/2.0 (https://commoncrawl.org/faq/)")).toBe(true);
    expect(isBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36")).toBe(false);
  });

  it("parse() exposes the same bot result", () => {
    const ua = "Mozilla/5.0 (compatible; SeznamBot/4.0; +https://o-seznam.cz/napoveda/vyhledavani/en/seznambot-crawler/)";
    expect(parse(ua).bot).toEqual(detectBot(ua));
    expect(parse(ua).device.type).toBe("bot");
  });

  it("counts: at least 25 operator-documented AI agents", () => {
    const ai = BOT_DEFINITIONS.filter((d) => AI.includes(d.category));
    expect(ai.length).toBeGreaterThanOrEqual(25);
  });
});
