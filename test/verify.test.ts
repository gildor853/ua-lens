import { describe, expect, it } from "vitest";
import { cidrsFromIpRanges, getVerificationHint, ipInCidrs, verifyBotDns, verifyBotHints, type DnsResolvers } from "../src/index.js";

const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const BINGBOT = "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) W.X.Y.Z Safari/537.36";

/** Fake DNS built from a table; mirrors the examples in the Bing / Google docs. */
function fakeDns(ptr: Record<string, string[]>, a: Record<string, string[]>): DnsResolvers {
  return {
    reverse: async (ip) => {
      const r = ptr[ip];
      if (r === undefined) throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
      return r;
    },
    forward: async (host) => a[host] ?? [],
  };
}

describe("ipInCidrs", () => {
  it("IPv4", () => {
    expect(ipInCidrs("157.55.39.1", ["157.55.39.0/24"])).toBe(true);
    expect(ipInCidrs("157.55.40.1", ["157.55.39.0/24"])).toBe(false);
    expect(ipInCidrs("10.0.0.1", ["0.0.0.0/0"])).toBe(true);
    expect(ipInCidrs("66.249.66.1", ["66.249.66.1"])).toBe(true);
    expect(ipInCidrs("66.249.66.1", ["66.249.66.1/32"])).toBe(true);
    expect(ipInCidrs("66.249.66.2", ["66.249.66.1/32"])).toBe(false);
    expect(ipInCidrs("17.241.208.170", ["17.241.208.160/27"])).toBe(true);
    expect(ipInCidrs("17.241.208.192", ["17.241.208.160/27"])).toBe(false);
  });

  it("IPv6, including compression and IPv4-mapped addresses", () => {
    expect(ipInCidrs("2001:4860:4801:10::1", ["2001:4860:4801:10::/64"])).toBe(true);
    expect(ipInCidrs("2001:4860:4801:11::1", ["2001:4860:4801:10::/64"])).toBe(false);
    expect(ipInCidrs("2001:4860:4801:0010:0000:0000:0000:0001", ["2001:4860:4801:10::/64"])).toBe(true);
    expect(ipInCidrs("::1", ["::1/128"])).toBe(true);
    expect(ipInCidrs("::", ["::/0"])).toBe(true);
    expect(ipInCidrs("::ffff:157.55.39.1", ["157.55.39.0/24"])).toBe(true);
    expect(ipInCidrs("157.55.39.1", ["::ffff:157.55.39.0/120"])).toBe(true);
    expect(ipInCidrs("157.55.39.1", ["::ffff:0:0/95"])).toBe(false);
    expect(ipInCidrs("fe80::1%eth0", ["fe80::/10"])).toBe(true);
    expect(ipInCidrs("2a02:598:64:8a00::302:340", ["2a02:598::/32"])).toBe(true);
    expect(ipInCidrs("1:2:3:4:5:6:7:8", ["1:2:3:4:5:6:7:8/128"])).toBe(true);
    expect(ipInCidrs("1::2:3:4:5:6:7", ["1:0:2:3:4:5:6:7/128"])).toBe(true);
  });

  it("never matches across families or on malformed input", () => {
    expect(ipInCidrs("157.55.39.1", ["2001:db8::/32"])).toBe(false);
    for (const bad of ["", "1.2.3", "1.2.3.4.5", "256.1.1.1", "01.2.3.4", "1.2.3.-1", ":::", "1::2::3", "12345::", "g::1", "1:2:3:4:5:6:7:8:9", "1:2:3:4:5:6:7", "::1.2.3", "1.2.3.4::", "x".repeat(100)]) {
      expect(ipInCidrs(bad, ["0.0.0.0/0", "::/0"]), bad).toBe(false);
    }
    for (const badCidr of ["1.2.3.0/33", "1.2.3.0/x", "1.2.3.0/24/1", "nope/8", "::/129", 5 as never]) {
      expect(ipInCidrs("1.2.3.4", [badCidr]), String(badCidr)).toBe(false);
    }
    expect(() => ipInCidrs(5 as never, [])).toThrow(/ip must be a string/);
    expect(() => ipInCidrs("1.2.3.4", "1.2.3.0/24" as never)).toThrow(/cidrs must be an array/);
  });
});

describe("cidrsFromIpRanges", () => {
  it("reads the common prefixes layout", () => {
    const json = {
      creationTime: "2026-10-09T14:46:27.000000",
      prefixes: [{ ipv6Prefix: "2001:4860:4801:10::/64" }, { ipv4Prefix: "66.249.64.0/27" }, { other: 1 }, null],
    };
    expect(cidrsFromIpRanges(json)).toEqual(["2001:4860:4801:10::/64", "66.249.64.0/27"]);
    expect(cidrsFromIpRanges(null)).toEqual([]);
    expect(cidrsFromIpRanges({ prefixes: "x" })).toEqual([]);
  });
});

describe("verification hints", () => {
  it("looks up the documented method for a UA or a detectBot result", () => {
    expect(getVerificationHint(GOOGLEBOT)).toMatchObject({ operator: "Google", reverseDnsSuffixes: ["googlebot.com", "google.com", "googleusercontent.com"] });
    expect(getVerificationHint(BINGBOT)?.ipRanges).toEqual(["https://www.bing.com/toolbox/bingbot.json"]);
    expect(getVerificationHint("ClaudeBot")?.method).toBe("none");
    expect(getVerificationHint("Mozilla/5.0 (Windows NT 10.0)")).toBeUndefined();
    expect(getVerificationHint("MJ12bot")).toBeUndefined();
    expect(verifyBotHints["__proto__"]).toBeUndefined();
  });
});

describe("verifyBotDns", () => {
  // From Bing's documentation: 157.55.39.1 ↔ msnbot-157-55-33-18.search.msn.com.
  const bing = fakeDns({ "157.55.39.1": ["msnbot-157-55-33-18.search.msn.com."] }, { "msnbot-157-55-33-18.search.msn.com.": ["157.55.39.1"] });

  it("forward-confirmed reverse DNS succeeds for a genuine host", async () => {
    await expect(verifyBotDns("157.55.39.1", BINGBOT, bing)).resolves.toMatchObject({
      verified: true,
      hostname: "msnbot-157-55-33-18.search.msn.com",
      reason: "ok",
    });
    await expect(verifyBotDns("157.55.39.1", "bing", bing)).resolves.toMatchObject({ verified: true });
  });

  it("rejects look-alike domains, mismatched forward lookups and missing PTRs", async () => {
    const spoof = fakeDns({ "6.6.6.6": ["crawl.googlebot.com.evil.example", "fakegooglebot.com"] }, {});
    await expect(verifyBotDns("6.6.6.6", GOOGLEBOT, spoof)).resolves.toMatchObject({ verified: false, reason: "domain-mismatch" });
    const lying = fakeDns({ "6.6.6.6": ["crawl-66-249-66-1.googlebot.com"] }, { "crawl-66-249-66-1.googlebot.com": ["66.249.66.1"] });
    await expect(verifyBotDns("6.6.6.6", GOOGLEBOT, lying)).resolves.toMatchObject({ verified: false, reason: "forward-mismatch" });
    await expect(verifyBotDns("7.7.7.7", GOOGLEBOT, lying)).resolves.toMatchObject({ verified: false, reason: "lookup-failed" });
    const empty = fakeDns({ "7.7.7.7": [] }, {});
    await expect(verifyBotDns("7.7.7.7", GOOGLEBOT, empty)).resolves.toMatchObject({ reason: "no-ptr" });
    const forwardThrows: DnsResolvers = { reverse: async () => ["crawl-1.googlebot.com"], forward: async () => Promise.reject(new Error("SERVFAIL")) };
    await expect(verifyBotDns("1.1.1.1", GOOGLEBOT, forwardThrows)).resolves.toMatchObject({ reason: "lookup-failed" });
  });

  it("normalises host names and rejects malformed PTR records", async () => {
    const upper = fakeDns({ "66.249.66.1": ["CRAWL-66-249-66-1.GOOGLEBOT.COM."] }, { "CRAWL-66-249-66-1.GOOGLEBOT.COM.": ["66.249.66.1"] });
    await expect(verifyBotDns("66.249.66.1", GOOGLEBOT, upper)).resolves.toMatchObject({ verified: true, hostname: "crawl-66-249-66-1.googlebot.com" });
    for (const bad of ["evil example.googlebot.com", "evil\n.googlebot.com", "-x.googlebot.com", "a..googlebot.com", `${"a".repeat(64)}.googlebot.com`, `${"a.".repeat(130)}googlebot.com`]) {
      const dns = fakeDns({ "66.249.66.1": [bad] }, { [bad]: ["66.249.66.1"] });
      await expect(verifyBotDns("66.249.66.1", GOOGLEBOT, dns), bad).resolves.toMatchObject({ verified: false, reason: "domain-mismatch" });
    }
    const odd = { reverse: async () => [5, null, "crawl-1.googlebot.com"], forward: async () => [null, "66.249.66.1"] } as unknown as DnsResolvers;
    await expect(verifyBotDns("66.249.66.1", GOOGLEBOT, odd)).resolves.toMatchObject({ verified: true });
    const notArray = { reverse: async () => "crawl-1.googlebot.com", forward: async () => [] } as unknown as DnsResolvers;
    await expect(verifyBotDns("66.249.66.1", GOOGLEBOT, notArray)).resolves.toMatchObject({ reason: "no-ptr" });
  });

  it("matches IPv6 and IPv4-mapped forms", async () => {
    const v6 = fakeDns({ "2001:4860:4801:10::1": ["crawl-x.googlebot.com"] }, { "crawl-x.googlebot.com": ["2001:4860:4801:0010:0:0:0:1"] });
    await expect(verifyBotDns("2001:4860:4801:10::1", GOOGLEBOT, v6)).resolves.toMatchObject({ verified: true });
    const mapped = fakeDns({ "::ffff:66.249.66.1": ["crawl-66-249-66-1.googlebot.com"] }, { "crawl-66-249-66-1.googlebot.com": ["66.249.66.1"] });
    await expect(verifyBotDns("::ffff:66.249.66.1", GOOGLEBOT, mapped)).resolves.toMatchObject({ verified: true });
  });

  it("reports when no DNS method exists or the bot is unknown", async () => {
    await expect(verifyBotDns("1.2.3.4", "Mozilla/5.0 (Windows NT 10.0)", bing)).resolves.toMatchObject({ reason: "unknown-bot" });
    await expect(verifyBotDns("1.2.3.4", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot", bing)).resolves.toMatchObject({
      reason: "no-dns-method",
      hint: { method: "ip-ranges" },
    });
    await expect(verifyBotDns("not-an-ip", GOOGLEBOT, bing)).resolves.toMatchObject({ reason: "invalid-ip" });
  });

  it("validates its arguments", async () => {
    await expect(verifyBotDns(1 as never, GOOGLEBOT, bing)).rejects.toThrow(/ip must be a string/);
    await expect(verifyBotDns("1.2.3.4", GOOGLEBOT, {} as never)).rejects.toThrow(/resolvers/);
    await expect(verifyBotDns("1.2.3.4", GOOGLEBOT, null as never)).rejects.toThrow(/resolvers/);
  });
});
