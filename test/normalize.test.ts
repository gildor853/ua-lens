import { describe, expect, it } from "vitest";
import { isMobile, normalize, normalizeResult, parse } from "../src/index.js";

const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

describe("normalize", () => {
  it("builds a compact label and a stable id", () => {
    expect(normalize(CHROME_WIN)).toEqual({
      label: "Chrome 143 / Windows 10+ / desktop",
      id: "chrome-143:windows-10+:desktop",
      browser: "chrome",
      browserMajor: 143,
      os: "windows",
      osVersion: "10+",
      device: "desktop",
      bot: undefined,
    });
  });

  it("uses Windows 11 once the hint resolves it", () => {
    expect(normalize(CHROME_WIN, { hints: { "sec-ch-ua-platform-version": '"15.0.0"' } }).label).toBe("Chrome 143 / Windows 11 / desktop");
  });

  it("labels known bots by name and category", () => {
    const n = normalize("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot");
    expect(n).toMatchObject({ label: "GPTBot 1.4 / bot (ai-crawler)", id: "gptbot:unknown:bot", bot: "gptbot", device: "bot" });
    expect(normalize("ClaudeBot").label).toBe("ClaudeBot / bot (ai-crawler)");
    const g = normalize("Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/ W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)");
    expect(g.id).toBe("googlebot:android-6:bot");
  });

  it("labels generic bots like browsers but flags them", () => {
    expect(normalize("MyCoolCrawler/1.0")).toMatchObject({ label: "Unknown browser / Unknown OS / bot", bot: "mycoolcrawler" });
    expect(normalize("something (+https://example.com/info)").bot).toBeUndefined();
  });

  it("handles empty input", () => {
    expect(normalize(undefined)).toMatchObject({ label: "Unknown browser / Unknown OS / unknown", id: "unknown:unknown:unknown" });
  });

  it("keeps major versions only", () => {
    const n = normalize("Mozilla/5.0 (Linux; Android 7.1.2; Nexus 5X Build/N2G47W; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/58.0.3029.83 Mobile Safari/537.36");
    expect(n.label).toBe("Chrome WebView 58 / Android 7 / mobile");
    expect(normalizeResult(parse("Opera/9.80 (Windows NT 5.1; U; ru) Presto/2.5.24 Version/10.53")).label).toBe("Opera 10 / Windows XP / desktop");
  });
});

describe("isMobile", () => {
  it("is true for phones only", () => {
    expect(isMobile("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36")).toBe(true);
    expect(isMobile("Mozilla/5.0 (Linux; Android 9; SM-T810) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.0.0 Safari/537.36")).toBe(false);
    expect(isMobile(CHROME_WIN)).toBe(false);
    expect(isMobile("", { hints: { "sec-ch-ua-mobile": "?1" } })).toBe(true);
  });
});
