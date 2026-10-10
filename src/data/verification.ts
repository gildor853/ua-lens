// How each operator says its crawlers can be verified (retrieved 2026-10-10).
// `reverseDnsSuffixes`: a reverse (PTR) lookup of the client IP must give a host
// name ending in one of these domains (at a label boundary), and a forward lookup
// of that host must return the same IP ("forward-confirmed reverse DNS").
// `ipRanges`: published lists. URLs ending in .json use the common
// `{"prefixes":[{"ipv4Prefix":"…"},{"ipv6Prefix":"…"}]}` layout understood by
// `cidrsFromIpRanges`; others are HTML pages.

/** Verification method documented by an operator. */
export type VerificationMethod = "reverse-dns" | "ip-ranges" | "reverse-dns-or-ip-ranges" | "none";

export interface BotVerificationHint {
  operator: string;
  method: VerificationMethod;
  reverseDnsSuffixes: readonly string[];
  ipRanges: readonly string[];
  /** Documentation describing the method. */
  docs: string;
  retrieved: string;
  note?: string;
}

const RETRIEVED = "2026-10-10";
const GOOGLE_VERIFY = "https://developers.google.com/crawling/docs/crawlers-fetchers/verifying-googlebot";
const GOOGLE_RDNS = ["googlebot.com", "google.com", "googleusercontent.com"] as const;
const GOOGLE_IPS = "https://developers.google.com/static/crawling/ipranges/";
const OPENAI = "https://platform.openai.com/docs/bots";
const PPLX = "https://docs.perplexity.ai/guides/bots";
const AMZ = "https://developer.amazon.com/amazonbot";
const MISTRAL = "https://docs.mistral.ai/robots";

type Row = Omit<BotVerificationHint, "retrieved" | "reverseDnsSuffixes" | "ipRanges"> & {
  reverseDnsSuffixes?: readonly string[];
  ipRanges?: readonly string[];
};
const hint = (r: Row): BotVerificationHint =>
  Object.freeze({
    ...r,
    reverseDnsSuffixes: Object.freeze([...(r.reverseDnsSuffixes ?? [])]),
    ipRanges: Object.freeze([...(r.ipRanges ?? [])]),
    retrieved: RETRIEVED,
  });

const HINTS: Record<string, BotVerificationHint> = {
  "google-common": hint({
    operator: "Google", method: "reverse-dns-or-ip-ranges", reverseDnsSuffixes: GOOGLE_RDNS,
    ipRanges: [`${GOOGLE_IPS}common-crawlers.json`], docs: GOOGLE_VERIFY,
    note: "Common crawlers resolve to crawl-*.googlebot.com or geo-crawl-*.geo.googlebot.com.",
  }),
  "google-special": hint({
    operator: "Google", method: "reverse-dns-or-ip-ranges", reverseDnsSuffixes: GOOGLE_RDNS,
    ipRanges: [`${GOOGLE_IPS}special-crawlers.json`], docs: GOOGLE_VERIFY,
    note: "Special-case crawlers resolve to rate-limited-proxy-*.google.com.",
  }),
  "google-user": hint({
    operator: "Google", method: "reverse-dns-or-ip-ranges", reverseDnsSuffixes: GOOGLE_RDNS,
    ipRanges: [
      `${GOOGLE_IPS}user-triggered-fetchers.json`,
      `${GOOGLE_IPS}user-triggered-fetchers-google.json`,
      `${GOOGLE_IPS}user-triggered-agents.json`,
    ],
    docs: GOOGLE_VERIFY,
    note: "User-triggered fetchers resolve to *.gae.googleusercontent.com or google-proxy-*.google.com.",
  }),
  bing: hint({
    operator: "Microsoft", method: "reverse-dns-or-ip-ranges", reverseDnsSuffixes: ["search.msn.com"],
    ipRanges: ["https://www.bing.com/toolbox/bingbot.json"],
    docs: "https://www.bing.com/webmasters/help/how-to-verify-bingbot-3905dc26",
  }),
  "openai-searchbot": hint({ operator: "OpenAI", method: "ip-ranges", ipRanges: ["https://openai.com/searchbot.json"], docs: OPENAI }),
  "openai-gptbot": hint({ operator: "OpenAI", method: "ip-ranges", ipRanges: ["https://openai.com/gptbot.json"], docs: OPENAI }),
  "openai-chatgpt-user": hint({ operator: "OpenAI", method: "ip-ranges", ipRanges: ["https://openai.com/chatgpt-user.json"], docs: OPENAI }),
  "openai-adsbot": hint({ operator: "OpenAI", method: "ip-ranges", ipRanges: ["https://openai.com/adsbot.json"], docs: OPENAI }),
  anthropic: hint({
    operator: "Anthropic", method: "none", docs: "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
    note: "Anthropic publishes no IP list or DNS pattern and advises robots.txt rather than IP blocking.",
  }),
  perplexitybot: hint({ operator: "Perplexity", method: "ip-ranges", ipRanges: ["https://www.perplexity.com/perplexitybot.json"], docs: PPLX }),
  "perplexity-user": hint({ operator: "Perplexity", method: "ip-ranges", ipRanges: ["https://www.perplexity.com/perplexity-user.json"], docs: PPLX }),
  meta: hint({
    operator: "Meta", method: "none", docs: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers",
    note: "The crawler page documents user agents and robots.txt behaviour but no verification method.",
  }),
  apple: hint({
    operator: "Apple", method: "reverse-dns-or-ip-ranges", reverseDnsSuffixes: ["applebot.apple.com"],
    ipRanges: ["https://search.developer.apple.com/applebot.json"], docs: "https://support.apple.com/en-us/119829",
  }),
  amazonbot: hint({ operator: "Amazon", method: "ip-ranges", ipRanges: ["https://developer.amazon.com/amazonbot/ip-addresses/"], docs: AMZ }),
  "amzn-searchbot": hint({ operator: "Amazon", method: "ip-ranges", ipRanges: ["https://developer.amazon.com/amazonbot/searchbot-ip-addresses/"], docs: AMZ }),
  "amzn-user": hint({ operator: "Amazon", method: "ip-ranges", ipRanges: ["https://developer.amazon.com/amazonbot/live-ip-addresses/"], docs: AMZ }),
  commoncrawl: hint({
    operator: "Common Crawl", method: "reverse-dns-or-ip-ranges", reverseDnsSuffixes: ["crawl.commoncrawl.org"],
    ipRanges: ["https://index.commoncrawl.org/ccbot.json"], docs: "https://commoncrawl.org/ccbot",
  }),
  "mistralai-user": hint({ operator: "Mistral AI", method: "ip-ranges", ipRanges: ["https://mistral.ai/mistralai-user-ips.json"], docs: MISTRAL }),
  "mistralai-index": hint({ operator: "Mistral AI", method: "ip-ranges", ipRanges: ["https://mistral.ai/mistralai-index-ips.json"], docs: MISTRAL }),
  duckassistbot: hint({
    operator: "DuckDuckGo", method: "ip-ranges", ipRanges: ["https://duckduckgo.com/duckassistbot.json"],
    docs: "https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot",
  }),
  duckduckbot: hint({
    operator: "DuckDuckGo", method: "ip-ranges", ipRanges: ["https://duckduckgo.com/duckduckbot.json"],
    docs: "https://duckduckgo.com/duckduckgo-help-pages/results/duckduckbot",
  }),
  youbot: hint({
    operator: "You.com", method: "reverse-dns-or-ip-ranges", reverseDnsSuffixes: ["search.you.com"], ipRanges: [],
    docs: "https://docs.you.com/youbot",
    note: "Hosts are youbot-*.search.you.com; You.com also documents 68.67.112.0/24 and Web Bot Auth signatures (https://you.com/.well-known/http-message-signatures-directory).",
  }),
  yandex: hint({
    operator: "Yandex", method: "reverse-dns", reverseDnsSuffixes: ["yandex.ru", "yandex.net", "yandex.com"],
    docs: "https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html",
    note: "Yandex does not publish its IP list.",
  }),
  baidu: hint({
    operator: "Baidu", method: "reverse-dns", reverseDnsSuffixes: ["baidu.com", "baidu.jp"],
    docs: "https://help.baidu.com/question?prod_id=99&class=476&id=2996",
  }),
  seznam: hint({
    operator: "Seznam.cz", method: "reverse-dns-or-ip-ranges", reverseDnsSuffixes: ["seznam.cz"],
    ipRanges: ["https://search.seznam.cz/ipranges/seznambot.json"],
    docs: "https://napoveda.seznam.cz/en/full-text-search/seznambot-crawler/",
    note: "Hosts are fulltextrobot-*.seznam.cz.",
  }),
  ahrefs: hint({
    operator: "Ahrefs", method: "reverse-dns-or-ip-ranges", reverseDnsSuffixes: ["ahrefs.com", "ahrefs.net"],
    ipRanges: ["https://api.ahrefs.com/v3/public/crawler-ip-ranges"], docs: "https://ahrefs.com/robot",
  }),
  pinterest: hint({
    operator: "Pinterest", method: "reverse-dns", reverseDnsSuffixes: ["pinterest.com", "pinterestcrawler.com"],
    docs: "https://help.pinterest.com/en/business/article/pinterest-crawler",
  }),
  discord: hint({
    operator: "Discord", method: "ip-ranges", ipRanges: ["https://cdn.discordapp.com/ipranges/discord.json"],
    docs: "https://support.discord.com/hc/en-us/articles/42500550752919",
  }),
};

/**
 * Official verification methods, keyed by the `verification` id that
 * {@link detectBot} reports. Read-only data.
 */
export const verifyBotHints: Readonly<Record<string, BotVerificationHint>> = Object.freeze(
  Object.assign(Object.create(null) as Record<string, BotVerificationHint>, HINTS),
);
