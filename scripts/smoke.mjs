// Runtime smoke test of the built package (ESM entry), run by CI on Node
// versions the test runner no longer supports. No dependencies, no network.
// The bare specifier resolves to ./dist through the package's "exports" map.
import assert from "node:assert/strict";
import { detectBot, ipInCidrs, isAiBot, isMobile, normalize, parse, parseHeaders, parseSfList, verifyBotDns } from "ua-lens";

const chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";
const r = parse(chrome);
assert.equal(r.browser.name, "Chrome");
assert.equal(r.browser.major, "143");
assert.equal(r.browser.version, undefined);
assert.deepEqual(r.frozen, ["browser.version", "os.version", "cpu.architecture"]);
assert.equal(normalize(chrome).id, "chrome-143:windows-10+:desktop");
assert.equal(parse(chrome, { hints: { "sec-ch-ua-platform": '"Windows"', "sec-ch-ua-platform-version": '"15.0.0"' } }).os.version, "11");
assert.equal(parseHeaders({ "User-Agent": chrome, "Sec-CH-UA": '"Chromium";v="146", "Not-A.Brand";v="24", "Brave";v="146"' }).browser.name, "Brave");
assert.equal(isMobile("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36"), true);
assert.equal(isAiBot("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot"), true);
assert.equal(detectBot("Mozilla/5.0 (compatible; SeznamBot/4.0; +https://o-seznam.cz/napoveda/vyhledavani/en/seznambot-crawler/)").category, "search-engine");
assert.equal(ipInCidrs("2001:4860:4801:10::1", ["2001:4860:4801:10::/64"]), true);
assert.equal(parseSfList('"a";v="1", "b"').length, 2);
const dns = { reverse: async () => ["crawl-66-249-66-1.googlebot.com"], forward: async () => ["66.249.66.1"] };
assert.equal((await verifyBotDns("66.249.66.1", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", dns)).verified, true);

console.log(`ESM smoke test passed on Node ${process.version}`);
