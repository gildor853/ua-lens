// Bot / crawler definitions.
//
// Every entry cites where its user-agent token comes from:
//   kind "operator"    – the operator's own documentation (all AI agents are operator-sourced);
//   kind "source-code" – the default User-Agent in the client's source code;
//   kind "reference"   – a widely used public test corpus (ua-parser/uap-core, Apache-2.0)
//                        because the operator publishes no documentation page.
// `retrieved` is the date the source was last read. Examples are copied from the
// cited source (Google / Bing / Amazon / Yandex docs use a `W.X.Y.Z` placeholder for
// the Chrome version, kept verbatim). Order matters: the first matching entry wins,
// so more specific tokens come before the tokens they contain.
//
// Deliberately NOT included (no current operator documentation could be found on
// 2026-10-10): anthropic-ai, Claude-Web, FacebookBot, cohere-ai / Coherebot,
// Timpibot, Bytespider, TelegramBot.
import type { BotCategory } from "../types.js";

/** Where a bot definition comes from. */
export interface BotSource {
  url: string;
  /** ISO date the source was read. */
  retrieved: string;
  kind: "operator" | "source-code" | "reference";
}

/** One known agent. */
export interface BotDefinition {
  /** Stable identifier (lowercase). */
  id: string;
  /** Canonical product token as documented by the operator. */
  name: string;
  /** Lowercase literal that must occur in the UA (cheap prefilter). */
  token: string;
  /** Linear-time pattern; group 1 (if any) is the version. */
  pattern: RegExp;
  category: BotCategory;
  operator: string;
  /** Operator documentation (or project) URL. */
  url: string;
  /** What the operator documents about robots.txt; undefined when not documented. */
  respectsRobotsTxt: boolean | undefined;
  /** Key into `verifyBotHints`. */
  verification?: string;
  sources: readonly BotSource[];
  /** Real UA strings (or the bare documented token when no full string is published). */
  examples: readonly string[];
  note?: string;
}

const RETRIEVED = "2026-10-10";
const operatorDoc = (url: string): BotSource => ({ url, retrieved: RETRIEVED, kind: "operator" });
const sourceCode = (url: string): BotSource => ({ url, retrieved: RETRIEVED, kind: "source-code" });
const reference = (url: string): BotSource => ({ url, retrieved: RETRIEVED, kind: "reference" });

const UAP = "https://github.com/ua-parser/uap-core/blob/master/tests/test_ua.yaml";
/** Version group: digits with up to four dotted parts, bounded. */
const V = String.raw`(\d{1,8}(?:\.\d{1,10}){0,4})`;

/** `\b<token>(?:/<version>)?` with the token escaped, case-insensitive. */
function tok(token: string, versioned = true): RegExp {
  const esc = token.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");
  return new RegExp(String.raw`(?:^|[^A-Za-z0-9_-])${esc}${versioned ? String.raw`(?:/${V})?` : ""}(?![A-Za-z0-9_-])`, "i");
}

type Def = Omit<BotDefinition, "token" | "pattern"> & { token?: string; pattern?: RegExp };
const def = (d: Def): BotDefinition => {
  const token = d.token ?? d.name.toLowerCase();
  return { ...d, token, pattern: d.pattern ?? tok(d.name) };
};

// ---------------------------------------------------------------- OpenAI
const OPENAI_DOC = "https://platform.openai.com/docs/bots";
const openai: BotDefinition[] = [
  def({
    id: "oai-searchbot", name: "OAI-SearchBot", category: "ai-search", operator: "OpenAI", url: OPENAI_DOC,
    respectsRobotsTxt: true, verification: "openai-searchbot", sources: [operatorDoc(OPENAI_DOC)],
    examples: [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; robots.txt; +https://openai.com/searchbot",
    ],
    note: "Surfaces sites in ChatGPT search; not used for training.",
  }),
  def({
    id: "oai-adsbot", name: "OAI-AdsBot", category: "other", operator: "OpenAI", url: OPENAI_DOC,
    respectsRobotsTxt: undefined, verification: "openai-adsbot", sources: [operatorDoc(OPENAI_DOC)],
    examples: ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-AdsBot/1.0; +https://openai.com/adsbot"],
    note: "Validates landing pages of ads submitted to ChatGPT.",
  }),
  def({
    id: "gptbot", name: "GPTBot", category: "ai-crawler", operator: "OpenAI", url: OPENAI_DOC,
    respectsRobotsTxt: true, verification: "openai-gptbot", sources: [operatorDoc(OPENAI_DOC)],
    examples: ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot"],
    note: "Crawls content that may be used to train generative AI foundation models.",
  }),
  def({
    id: "chatgpt-user", name: "ChatGPT-User", category: "ai-assistant", operator: "OpenAI", url: OPENAI_DOC,
    respectsRobotsTxt: false, verification: "openai-chatgpt-user", sources: [operatorDoc(OPENAI_DOC)],
    examples: ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot"],
    note: "User-initiated fetches; OpenAI states robots.txt rules may not apply.",
  }),
];

// ---------------------------------------------------------------- Anthropic
const ANTHROPIC_DOC =
  "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler";
const anthropic: BotDefinition[] = [
  def({
    id: "claude-searchbot", name: "Claude-SearchBot", category: "ai-search", operator: "Anthropic", url: ANTHROPIC_DOC,
    respectsRobotsTxt: true, verification: "anthropic", sources: [operatorDoc(ANTHROPIC_DOC)], examples: ["Claude-SearchBot"],
    note: "Anthropic documents the robots.txt token only, not a full UA string.",
  }),
  def({
    id: "claude-user", name: "Claude-User", category: "ai-assistant", operator: "Anthropic", url: ANTHROPIC_DOC,
    respectsRobotsTxt: true, verification: "anthropic", sources: [operatorDoc(ANTHROPIC_DOC)], examples: ["Claude-User"],
    note: "Anthropic documents the robots.txt token only, not a full UA string.",
  }),
  def({
    id: "claudebot", name: "ClaudeBot", category: "ai-crawler", operator: "Anthropic", url: ANTHROPIC_DOC,
    respectsRobotsTxt: true, verification: "anthropic", sources: [operatorDoc(ANTHROPIC_DOC)], examples: ["ClaudeBot"],
    note: "Anthropic documents the robots.txt token only, not a full UA string.",
  }),
];

// ---------------------------------------------------------------- Google
const G_COMMON = "https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers";
const G_SPECIAL = "https://developers.google.com/crawling/docs/crawlers-fetchers/google-special-case-crawlers";
const G_USER = "https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers";
const gc = (d: Omit<Def, "operator" | "url" | "sources" | "verification" | "respectsRobotsTxt">): BotDefinition =>
  def({ ...d, operator: "Google", url: G_COMMON, sources: [operatorDoc(G_COMMON)], verification: "google-common", respectsRobotsTxt: true });
const gs = (d: Omit<Def, "operator" | "url" | "sources" | "verification">): BotDefinition =>
  def({ ...d, operator: "Google", url: G_SPECIAL, sources: [operatorDoc(G_SPECIAL)], verification: "google-special" });
const gu = (d: Omit<Def, "operator" | "url" | "sources" | "verification" | "respectsRobotsTxt">): BotDefinition =>
  def({ ...d, operator: "Google", url: G_USER, sources: [operatorDoc(G_USER)], verification: "google-user", respectsRobotsTxt: false });

const google: BotDefinition[] = [
  gs({
    id: "adsbot-google-mobile", name: "AdsBot-Google-Mobile", category: "other", respectsRobotsTxt: false,
    examples: [
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/ W.X.Y.Z Mobile Safari/537.36 (compatible; AdsBot-Google-Mobile; +http://www.google.com/mobile/adsbot.html)",
    ],
    note: "Ignores the global `*` robots.txt group; obeys rules addressed to it.",
  }),
  gs({
    id: "adsbot-google", name: "AdsBot-Google", category: "other", respectsRobotsTxt: false,
    examples: ["AdsBot-Google (+http://www.google.com/adsbot.html)"],
    note: "Ignores the global `*` robots.txt group; obeys rules addressed to it.",
  }),
  gs({
    id: "apis-google", name: "APIs-Google", category: "other", respectsRobotsTxt: false,
    examples: ["APIs-Google (+https://developers.google.com/webmasters/APIs-Google.html)"],
    note: "Ignores the global `*` robots.txt group.",
  }),
  gs({
    id: "mediapartners-google", name: "Mediapartners-Google", category: "other", respectsRobotsTxt: false,
    examples: ["Mediapartners-Google", "(compatible; Mediapartners-Google/2.1; +http://www.google.com/bot.html)"],
    note: "AdSense crawler; ignores the global `*` robots.txt group.",
  }),
  gs({
    id: "google-safety", name: "Google-Safety", category: "security-scanner", respectsRobotsTxt: false,
    examples: ["Google-Safety"], note: "Abuse / malware discovery; ignores robots.txt.",
  }),
  gc({ id: "googlebot-image", name: "Googlebot-Image", category: "search-engine", examples: ["Googlebot-Image/1.0"] }),
  gc({ id: "googlebot-video", name: "Googlebot-Video", category: "search-engine", examples: ["Googlebot-Video/1.0"] }),
  gc({
    id: "storebot-google", name: "Storebot-Google", category: "search-engine",
    examples: [
      "Mozilla/5.0 (X11; Linux x86_64; Storebot-Google/1.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/ W.X.Y.Z Safari/537.36",
      "Mozilla/5.0 (Linux; Android 8.0; Pixel 2 Build/OPD3.170816.012; Storebot-Google/1.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/ W.X.Y.Z Mobile Safari/537.36",
    ],
  }),
  gc({
    id: "google-inspectiontool", name: "Google-InspectionTool", category: "search-engine",
    examples: [
      "Mozilla/5.0 (compatible; Google-InspectionTool/1.0)",
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/ W.X.Y.Z Mobile Safari/537.36 (compatible; Google-InspectionTool/1.0)",
    ],
    note: "Search Console URL inspection / Rich Results Test.",
  }),
  gc({ id: "googleother-image", name: "GoogleOther-Image", category: "other", examples: ["GoogleOther-Image/1.0"] }),
  gc({ id: "googleother-video", name: "GoogleOther-Video", category: "other", examples: ["GoogleOther-Video/1.0"] }),
  gc({
    id: "googleother", name: "GoogleOther", category: "other",
    examples: [
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/ W.X.Y.Z Mobile Safari/537.36 (compatible; GoogleOther)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GoogleOther) Chrome/ W.X.Y.Z Safari/537.36",
    ],
    note: "Generic crawler used by product teams, e.g. for research crawls.",
  }),
  gc({
    id: "google-cloudvertexbot", name: "Google-CloudVertexBot", category: "ai-crawler", examples: ["Google-CloudVertexBot"],
    note: "Crawls on site owners' request to build Vertex AI Agents; Google documents a UA substring only.",
  }),
  gc({
    id: "googlebot", name: "Googlebot", category: "search-engine",
    examples: [
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/ W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/ W.X.Y.Z Safari/537.36",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Googlebot/2.1 (+http://www.google.com/bot.html)",
    ],
  }),
  gu({
    id: "google-gemininotebook", name: "Google-GeminiNotebook", category: "ai-assistant",
    examples: [
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 (compatible; Google-GeminiNotebook; +https://developers.google.com/crawling/docs/crawlers-fetchers/google-gemininotebook)",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 (compatible; Google-GeminiNotebook; +https://developers.google.com/crawling/docs/crawlers-fetchers/google-gemininotebook)",
    ],
    note: "Fetches URLs users add as sources. Formerly Google-NotebookLM (supported until August 2026).",
  }),
  gu({
    id: "google-notebooklm", name: "Google-NotebookLM", category: "ai-assistant", examples: ["Google-NotebookLM"],
    note: "Former name of Google-GeminiNotebook (supported until August 2026).",
  }),
  gu({
    id: "google-agent", name: "Google-Agent", category: "ai-assistant",
    examples: [
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Google-Agent; +https://developers.google.com/crawling/docs/crawlers-fetchers/google-agent)",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko; compatible; Google-Agent; +https://developers.google.com/crawling/docs/crawlers-fetchers/google-agent) Chrome/W.X.Y.Z Safari/537.36",
    ],
    note: "Agents hosted on Google infrastructure acting on user request.",
  }),
  gu({
    id: "google-read-aloud", name: "Google-Read-Aloud", category: "other",
    examples: [
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 (compatible; Google-Read-Aloud; +https://support.google.com/webmasters/answer/1061943)",
    ],
    note: "Text-to-speech on user request. Formerly google-speakr.",
  }),
  gu({ id: "feedfetcher-google", name: "FeedFetcher-Google", category: "feed-reader", examples: ["FeedFetcher-Google; (+http://www.google.com/feedfetcher.html)"] }),
  gu({
    id: "googleproducer", name: "GoogleProducer", category: "feed-reader",
    examples: ["GoogleProducer; (+https://developers.google.com/search/docs/crawling-indexing/google-producer)"],
  }),
  gu({ id: "google-cws", name: "Google-CWS", category: "other", examples: ["Mozilla/5.0 (compatible; Google-CWS)"], note: "Chrome Web Store metadata fetcher." }),
  gu({ id: "googlemessages", name: "GoogleMessages", category: "social-preview", examples: ["GoogleMessages"] }),
  gu({ id: "google-pinpoint", name: "Google-Pinpoint", category: "other", examples: ["Google-Pinpoint"] }),
  gu({ id: "google-site-verification", name: "Google-Site-Verification", category: "other", examples: ["Mozilla/5.0 (compatible; Google-Site-Verification/1.0)"] }),
];

// ---------------------------------------------------------------- Other AI operators
const PPLX_DOC = "https://docs.perplexity.ai/guides/bots";
const META_DOC = "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers";
const AMZ_DOC = "https://developer.amazon.com/amazonbot";
const MISTRAL_DOC = "https://docs.mistral.ai/robots";
const aiOthers: BotDefinition[] = [
  def({
    id: "perplexity-user", name: "Perplexity-User", category: "ai-assistant", operator: "Perplexity", url: PPLX_DOC,
    respectsRobotsTxt: false, verification: "perplexity-user", sources: [operatorDoc(PPLX_DOC)],
    examples: ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)"],
    note: "User-initiated; Perplexity states it generally ignores robots.txt.",
  }),
  def({
    id: "perplexitybot", name: "PerplexityBot", category: "ai-search", operator: "Perplexity", url: PPLX_DOC,
    respectsRobotsTxt: true, verification: "perplexitybot", sources: [operatorDoc(PPLX_DOC)],
    examples: ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)"],
    note: "Surfaces sites in Perplexity search; not used for foundation-model training.",
  }),
  def({
    id: "meta-externalagent", name: "meta-externalagent", category: "ai-crawler", operator: "Meta", url: META_DOC,
    respectsRobotsTxt: true, verification: "meta", sources: [operatorDoc(META_DOC)],
    examples: ["meta-externalagent/1.1 (+/documentation/sharing/webmasters/web-crawlers)", "meta-externalagent/1.1"],
    note: "Training foundation AI models or indexing content.",
  }),
  def({
    id: "meta-externalfetcher", name: "meta-externalfetcher", category: "ai-assistant", operator: "Meta", url: META_DOC,
    respectsRobotsTxt: false, verification: "meta", sources: [operatorDoc(META_DOC)],
    examples: ["meta-externalfetcher/1.1 (+/documentation/sharing/webmasters/web-crawlers)", "meta-externalfetcher/1.1"],
    note: "User-requested fetches; may bypass robots.txt.",
  }),
  def({
    id: "meta-webindexer", name: "meta-webindexer", category: "ai-search", operator: "Meta", url: META_DOC,
    respectsRobotsTxt: true, verification: "meta", sources: [operatorDoc(META_DOC)],
    examples: ["meta-webindexer/1.1 (+/documentation/sharing/webmasters/web-crawlers)", "meta-webindexer/1.1"],
    note: "Improves Meta AI search results.",
  }),
  def({
    id: "meta-externalads", name: "meta-externalads", category: "other", operator: "Meta", url: META_DOC,
    respectsRobotsTxt: true, verification: "meta", sources: [operatorDoc(META_DOC)],
    examples: ["meta-externalads/1.1 (+/documentation/sharing/webmasters/web-crawlers)", "meta-externalads/1.1"],
  }),
  def({
    id: "amazonbot", name: "Amazonbot", category: "ai-crawler", operator: "Amazon", url: AMZ_DOC,
    respectsRobotsTxt: true, verification: "amazonbot", sources: [operatorDoc(AMZ_DOC)],
    examples: ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1) Chrome/W.X.Y.Z Safari/537.36"],
    note: "Improves Amazon products; content may be used to train Amazon AI models.",
  }),
  def({
    id: "amzn-searchbot", name: "Amzn-SearchBot", category: "ai-search", operator: "Amazon", url: AMZ_DOC,
    respectsRobotsTxt: true, verification: "amzn-searchbot", sources: [operatorDoc(AMZ_DOC)],
    examples: ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amzn-SearchBot/0.1) Chrome/W.X.Y.Z Safari/537.36"],
    note: "Search experiences such as Alexa; not used for generative AI training.",
  }),
  def({
    id: "amzn-user", name: "Amzn-User", category: "ai-assistant", operator: "Amazon", url: AMZ_DOC,
    respectsRobotsTxt: false, verification: "amzn-user", sources: [operatorDoc(AMZ_DOC)],
    examples: ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amzn-User/0.1) Chrome/W.X.Y.Z Safari/537.36"],
    note: "User-initiated; Amazon states it may not follow all robots.txt directives.",
  }),
  def({
    id: "ccbot", name: "CCBot", category: "ai-crawler", operator: "Common Crawl", url: "https://commoncrawl.org/ccbot",
    respectsRobotsTxt: true, verification: "commoncrawl", sources: [operatorDoc("https://commoncrawl.org/ccbot")],
    examples: ["CCBot/2.0 (https://commoncrawl.org/faq/)"],
    note: "Open web corpus widely used for AI training.",
  }),
  def({
    id: "mistralai-user", name: "MistralAI-User", category: "ai-assistant", operator: "Mistral AI", url: MISTRAL_DOC,
    respectsRobotsTxt: true, verification: "mistralai-user", sources: [operatorDoc(MISTRAL_DOC)],
    examples: ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-User/1.0; +https://docs.mistral.ai/robots)"],
  }),
  def({
    id: "mistralai-index", name: "MistralAI-Index", category: "ai-search", operator: "Mistral AI", url: MISTRAL_DOC,
    respectsRobotsTxt: true, verification: "mistralai-index", sources: [operatorDoc(MISTRAL_DOC)],
    examples: ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-Index/1.0; +https://docs.mistral.ai/robots)"],
    note: "Indexing for Mistral search; not used for generative AI training.",
  }),
  def({
    id: "mistralai-training", name: "MistralAI-Training", category: "ai-crawler", operator: "Mistral AI", url: MISTRAL_DOC,
    respectsRobotsTxt: true, sources: [operatorDoc(MISTRAL_DOC)],
    examples: ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-Training/1.0; +https://docs.mistral.ai/robots)"],
  }),
  def({
    id: "duckassistbot", name: "DuckAssistBot", category: "ai-search", operator: "DuckDuckGo",
    url: "https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot", respectsRobotsTxt: true, verification: "duckassistbot",
    sources: [operatorDoc("https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot")],
    examples: ["DuckAssistBot/1.2; (+http://duckduckgo.com/duckassistbot.html)"],
    note: "Sources for AI-assisted answers; DuckDuckGo states the data is not used to train AI models.",
  }),
  def({
    id: "youbot", name: "YouBot", category: "ai-search", operator: "You.com", url: "https://docs.you.com/youbot",
    respectsRobotsTxt: true, verification: "youbot", sources: [operatorDoc("https://docs.you.com/youbot")],
    examples: ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; YouBot/1.0; +https://docs.you.com/youbot; env:prod) Chrome/X.X.X.X Safari/537.36"],
  }),
  def({
    id: "imagesiftbot", name: "ImagesiftBot", category: "other", operator: "ImageSift", url: "https://imagesift.com/about",
    respectsRobotsTxt: true, sources: [operatorDoc("https://imagesift.com/about")],
    examples: ["Mozilla/5.0 (compatible; ImagesiftBot; +imagesift.com)"],
    note: "Image search / web-intelligence crawler.",
  }),
];

// ---------------------------------------------------------------- Search engines
const BING_DOC = "https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0";
const APPLE_DOC = "https://support.apple.com/en-us/119829";
const BAIDU_DOC = "https://help.baidu.com/question?prod_id=99&class=476&id=2996";
const DIFFBOT_DOC = "https://www.diffbot.com/docs/crawl/faq/robots-txt";
const search: BotDefinition[] = [
  def({
    id: "bingvideopreview", name: "BingVideoPreview", category: "search-engine", operator: "Microsoft", url: BING_DOC,
    respectsRobotsTxt: undefined, verification: "bing", sources: [operatorDoc(BING_DOC)], examples: ["BingVideoPreview"],
  }),
  def({
    id: "microsoftpreview", name: "MicrosoftPreview", category: "social-preview", operator: "Microsoft", url: BING_DOC,
    respectsRobotsTxt: undefined, verification: "bing", sources: [operatorDoc(BING_DOC)],
    examples: [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MicrosoftPreview/2.0; +https://aka.ms/MicrosoftPreview) Chrome/W.X.Y.Z Safari/537.36",
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; MicrosoftPreview/2.0; +https://aka.ms/MicrosoftPreview)",
    ],
    note: "Page snapshots for Microsoft products.",
  }),
  def({
    id: "adidxbot", name: "adidxbot", category: "other", operator: "Microsoft", url: BING_DOC,
    respectsRobotsTxt: true, verification: "bing", sources: [operatorDoc(BING_DOC)],
    examples: [
      "Mozilla/5.0 (compatible; adidxbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 7_0 like Mac OS X) AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11A465 Safari/9537.53 (compatible; adidxbot/2.0; +http://www.bing.com/bingbot.htm)",
    ],
    note: "Bing Ads crawler.",
  }),
  def({
    id: "bingbot", name: "bingbot", category: "search-engine", operator: "Microsoft", url: BING_DOC,
    respectsRobotsTxt: true, verification: "bing", sources: [operatorDoc(BING_DOC)],
    examples: [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/ W.X.Y.Z Safari/537.36",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) W.X.Y.Z Safari/537.36",
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/ W.X.Y.Z Mobile Safari/537.36 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    ],
  }),
  def({
    id: "applebot", name: "Applebot", category: "search-engine", operator: "Apple", url: APPLE_DOC,
    respectsRobotsTxt: true, verification: "apple", sources: [operatorDoc(APPLE_DOC)],
    examples: [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1 (Applebot/0.1; +http://www.apple.com/go/applebot)",
    ],
    note: "Spotlight / Siri / Safari search; crawled data may also train Apple foundation models (opt out via the Applebot-Extended robots.txt token).",
  }),
  def({
    id: "duckduckbot", name: "DuckDuckBot", category: "search-engine", operator: "DuckDuckGo",
    url: "https://duckduckgo.com/duckduckgo-help-pages/results/duckduckbot", respectsRobotsTxt: true, verification: "duckduckbot",
    sources: [operatorDoc("https://duckduckgo.com/duckduckgo-help-pages/results/duckduckbot")],
    examples: ["DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)"],
  }),
  def({
    id: "baiduspider", name: "Baiduspider", category: "search-engine", operator: "Baidu", url: BAIDU_DOC,
    pattern: new RegExp(String.raw`\b(Baiduspider(?:-(?:image|video|news|favo|cpro|ads))?)(?:/${V})?`, "i"),
    respectsRobotsTxt: true, verification: "baidu", sources: [operatorDoc(BAIDU_DOC)],
    examples: [
      "Mozilla/5.0 (compatible; Baiduspider/2.0; + http://www.baidu.com/search/spider.html）",
      "Mozilla/5.0 (Linux;u;Android 4.2.2;zh-cn;) AppleWebKit/534.46 (KHTML,like Gecko) Version/5.1 Mobile Safari/10600.6.3 (compatible; Baiduspider/2.0; + http://www.baidu.com/search/spider.html )",
      "Baiduspider-image",
    ],
    note: "Product variants Baiduspider-image/-video/-news/-favo/-cpro/-ads are reported by name; Baidu's FAQ says cpro and ads do not obey robots.txt.",
  }),
  def({
    id: "seznambot", name: "SeznamBot", category: "search-engine", operator: "Seznam.cz",
    url: "https://napoveda.seznam.cz/en/full-text-search/seznambot-crawler/", respectsRobotsTxt: true, verification: "seznam",
    sources: [operatorDoc("https://napoveda.seznam.cz/en/full-text-search/seznambot-crawler/")],
    examples: ["Mozilla/5.0 (compatible; SeznamBot/4.0; +https://o-seznam.cz/napoveda/vyhledavani/en/seznambot-crawler/)"],
  }),
  def({
    id: "diffbot-user", name: "Diffbot-User", category: "other", operator: "Diffbot", url: DIFFBOT_DOC,
    respectsRobotsTxt: undefined, sources: [operatorDoc(DIFFBOT_DOC)], examples: ["Diffbot-User"],
    note: "Requests on behalf of a human user of Diffbot software.",
  }),
  def({
    id: "diffbot", name: "Diffbot", category: "search-engine", operator: "Diffbot", url: DIFFBOT_DOC,
    respectsRobotsTxt: true, sources: [operatorDoc(DIFFBOT_DOC)], examples: ["Diffbot"],
    note: "Knowledge Graph / web search; Diffbot states it is not used for AI training.",
  }),
];

// ---------------------------------------------------------------- Yandex (one entry per documented robot)
const YANDEX_DOC = "https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html";
type YandexRow = readonly [name: string, category: BotCategory, respectsRobotsTxt: boolean, example: string];
const yb = (name: string, version: string, extra = "") => `Mozilla/5.0 (compatible; ${name}/${version};${extra} +http://yandex.com/bots)`;
const YANDEX_ROWS: readonly YandexRow[] = [
  ["YandexAccessibilityBot", "monitoring", false, yb("YandexAccessibilityBot", "3.0")],
  ["YandexAdNet", "other", true, yb("YandexAdNet", "1.0")],
  ["YandexAdditionalBot", "ai-search", false, yb("YandexAdditionalBot", "1.0")],
  ["YandexAdditional", "ai-search", false, yb("YandexAdditional", "1.0")],
  ["YandexBlogs", "search-engine", true, yb("YandexBlogs", "0.99", " robot;")],
  ["YandexCalendar", "other", false, yb("YandexCalendar", "1.0")],
  ["YandexCheckBot", "monitoring", false, yb("YandexCheckBot", "3.0")],
  ["YandexComBot", "search-engine", false, "Mozilla/5.0 (compatible; YandexComBot/3.0; +http://ya.cc/bots)"],
  ["YandexDirectDyn", "other", false, yb("YandexDirectDyn", "1.0")],
  ["YandexDirect", "other", false, yb("YandexDirect", "3.0")],
  ["YaDirectFetcher", "other", false, "Mozilla/5.0 (compatible; YaDirectFetcher/1.0; Dyatel; +http://yandex.com/bots)"],
  ["YandexFavicons", "search-engine", false, yb("YandexFavicons", "1.0")],
  ["YandexFeed", "feed-reader", false, yb("YandexFeed", "1.0")],
  ["YandexImageResizer", "search-engine", true, yb("YandexImageResizer", "2.0")],
  ["YandexImages", "search-engine", true, yb("YandexImages", "3.0")],
  ["YandexMarket", "search-engine", true, yb("YandexMarket", "1.0")],
  ["YandexMedia", "search-engine", true, yb("YandexMedia", "3.0")],
  ["YandexMetrika", "monitoring", false, yb("YandexMetrika", "2.0")],
  ["YandexMobileBot", "search-engine", false,
    "Mozilla/5.0 (iPhone; CPU iPhone OS 8_1 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12B411 Safari/600.1.4 (compatible; YandexMobileBot/3.0; +http://yandex.com/bots)"],
  ["YandexMobileScreenShotBot", "other", false, yb("YandexMobileScreenShotBot", "1.0")],
  ["YandexOntoDBAPI", "search-engine", false, yb("YandexOntoDBAPI", "1.0")],
  ["YandexOntoDB", "search-engine", true, yb("YandexOntoDB", "1.0")],
  ["YandexPagechecker", "seo", true, yb("YandexPagechecker", "1.0")],
  ["YandexPartner", "other", false, yb("YandexPartner", "3.0")],
  ["YandexRCA", "social-preview", false, yb("YandexRCA", "1.0")],
  ["YandexRenderResourcesBot", "search-engine", false, yb("YandexRenderResourcesBot", "1.0")],
  ["YandexScreenshotBot", "other", false,
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z* Safari/537.36 (compatible; YandexScreenshotBot/3.0; +http://yandex.com/bots)"],
  ["YandexSearchShop", "feed-reader", false, yb("YandexSearchShop", "1.0")],
  ["YandexSitelinks", "search-engine", true, "Mozilla/5.0 (compatible; YandexSitelinks; Dyatel; +http://yandex.com/bots)"],
  ["YandexSpravBot", "search-engine", true, yb("YandexSpravBot", "1.0")],
  ["YandexTracker", "other", false, yb("YandexTracker", "1.0")],
  ["YandexUserproxy", "other", false, "Mozilla/5.0 (compatible; YandexUserproxy; robot; +http://yandex.com/bots)"],
  ["YandexVerticals", "search-engine", true, yb("YandexVerticals", "1.0")],
  ["YandexVertis", "search-engine", true, yb("YandexVertis", "3.0")],
  ["YandexVideoParser", "search-engine", false, yb("YandexVideoParser", "1.0")],
  ["YandexVideo", "search-engine", true, yb("YandexVideo", "3.0")],
  ["YandexWebmaster", "seo", true, yb("YandexWebmaster", "2.0")],
  ["YandexBot", "search-engine", true, yb("YandexBot", "3.0")],
];
const yandex: BotDefinition[] = YANDEX_ROWS.map(([name, category, respectsRobotsTxt, example]) =>
  def({
    id: name.toLowerCase(), name, category, operator: "Yandex", url: YANDEX_DOC, respectsRobotsTxt,
    verification: "yandex", sources: [operatorDoc(YANDEX_DOC)], examples: [example],
  }),
);

// ---------------------------------------------------------------- SEO tools
const AHREFS_DOC = "https://ahrefs.com/robot";
const SEMRUSH_DOC = "https://www.semrush.com/bot/";
const seo: BotDefinition[] = [
  def({
    id: "ahrefssiteaudit", name: "AhrefsSiteAudit", category: "seo", operator: "Ahrefs", url: AHREFS_DOC,
    respectsRobotsTxt: true, verification: "ahrefs", sources: [operatorDoc(AHREFS_DOC)],
    examples: [
      "Mozilla/5.0 (compatible; AhrefsSiteAudit/6.1; +http://ahrefs.com/robot/site-audit)",
      "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.173 Mobile Safari/537.36 (compatible; AhrefsSiteAudit/6.1; +http://ahrefs.com/robot/site-audit)",
    ],
  }),
  def({
    id: "ahrefsbot", name: "AhrefsBot", category: "seo", operator: "Ahrefs", url: AHREFS_DOC,
    respectsRobotsTxt: true, verification: "ahrefs", sources: [operatorDoc(AHREFS_DOC)],
    examples: ["Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)"],
  }),
  ...(
    [
      "SemrushBot-BA", "SemrushBot-SI", "SemrushBot-SWA", "SemrushBot-OCOB", "SemrushBot-FT", "SemrushBot-ESI",
      "SemrushBot", "SiteAuditBot", "SplitSignalBot",
    ] as const
  ).map((name) =>
    def({
      id: name.toLowerCase(), name, category: "seo", operator: "Semrush", url: SEMRUSH_DOC, respectsRobotsTxt: true,
      sources: [operatorDoc(SEMRUSH_DOC)], examples: [name],
      note: "Semrush documents robots.txt tokens; it does not publish full UA strings or IP ranges.",
    }),
  ),
  def({
    id: "mj12bot", name: "MJ12bot", category: "seo", operator: "Majestic", url: "https://mj12bot.com/",
    respectsRobotsTxt: true, sources: [operatorDoc("https://mj12bot.com/")], examples: ["MJ12bot"],
    note: "Majestic says it uses no consecutive IP blocks, so it cannot be verified by IP.",
  }),
  def({
    id: "dotbot", name: "DotBot", token: "dotbot", category: "seo", operator: "Moz",
    url: "https://moz.com/help/moz-procedures/crawlers/dotbot", respectsRobotsTxt: true,
    sources: [operatorDoc("https://moz.com/help/moz-procedures/crawlers/dotbot")], examples: ["dotbot"],
  }),
  def({
    id: "rogerbot", name: "rogerbot", category: "seo", operator: "Moz", url: "https://moz.com/help/moz-procedures/crawlers/rogerbot",
    respectsRobotsTxt: true, sources: [operatorDoc("https://moz.com/help/moz-procedures/crawlers/dotbot")], examples: ["rogerbot"],
  }),
];

// ---------------------------------------------------------------- Social previews
const social: BotDefinition[] = [
  def({
    id: "facebookexternalhit", name: "facebookexternalhit", category: "social-preview", operator: "Meta", url: META_DOC,
    respectsRobotsTxt: true, verification: "meta", sources: [operatorDoc(META_DOC)],
    examples: ["facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "facebookexternalhit/1.1"],
    note: "May bypass robots.txt for security / integrity checks.",
  }),
  def({
    id: "whatsapp", name: "WhatsApp", category: "social-preview", operator: "Meta",
    url: "https://developers.facebook.com/docs/whatsapp/link-previews/",
    pattern: new RegExp(String.raw`^WhatsApp/${V}(?: [AIN])?$`),
    respectsRobotsTxt: undefined, sources: [operatorDoc("https://developers.facebook.com/docs/whatsapp/link-previews/")],
    examples: ["WhatsApp/2.22.20.72 A", "WhatsApp/2.22.19.78 I", "WhatsApp/2.2236.3 N"],
    note: "Link-preview fetcher; the whole UA is `WhatsApp/<version> A|I|N`.",
  }),
  def({
    id: "slackbot-linkexpanding", name: "Slackbot-LinkExpanding", category: "social-preview", operator: "Slack",
    url: "https://api.slack.com/robots", pattern: new RegExp(String.raw`\bSlackbot-LinkExpanding(?: ${V})?`, "i"),
    respectsRobotsTxt: undefined, sources: [operatorDoc("https://api.slack.com/robots")],
    examples: ["Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"],
  }),
  def({
    id: "slackbot", name: "Slackbot", category: "social-preview", operator: "Slack", url: "https://api.slack.com/robots",
    pattern: new RegExp(String.raw`\bSlackbot(?: ${V})?(?![A-Za-z0-9_-])`, "i"),
    respectsRobotsTxt: undefined, sources: [operatorDoc("https://api.slack.com/robots")],
    examples: ["Slackbot 1.0 (+https://api.slack.com/robots)"],
  }),
  def({
    id: "discordbot", name: "Discordbot", category: "social-preview", operator: "Discord",
    url: "https://support.discord.com/hc/en-us/articles/42500550752919", respectsRobotsTxt: undefined, verification: "discord",
    sources: [operatorDoc("https://support.discord.com/hc/en-us/articles/42500550752919")],
    examples: ["Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"],
  }),
  def({
    id: "pinterestbot", name: "Pinterestbot", category: "social-preview", operator: "Pinterest",
    url: "https://help.pinterest.com/en/business/article/pinterest-crawler", respectsRobotsTxt: true, verification: "pinterest",
    sources: [operatorDoc("https://help.pinterest.com/en/business/article/pinterest-crawler")],
    examples: [
      "Mozilla/5.0 (compatible; Pinterestbot/1.0; +https://www.pinterest.com/bot.html)",
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.96 Mobile Safari/537.36 (compatible; Pinterestbot/1.0; +https://www.pinterest.com/bot.html)",
    ],
  }),
  def({
    id: "pinterest", name: "Pinterest", token: "pinterest/0.", category: "social-preview", operator: "Pinterest",
    url: "https://help.pinterest.com/en/business/article/pinterest-crawler",
    pattern: /^Pinterest\/(0\.\d{1,4}) \(\+https?:\/\/www\.pinterest\.com\//,
    respectsRobotsTxt: true, verification: "pinterest",
    sources: [operatorDoc("https://help.pinterest.com/en/business/article/pinterest-crawler")],
    examples: ["Pinterest/0.2 (+https://www.pinterest.com/bot.html)"],
  }),
  def({
    id: "twitterbot", name: "Twitterbot", category: "social-preview", operator: "X (Twitter)", url: "https://x.com",
    respectsRobotsTxt: undefined, sources: [reference(UAP)], examples: ["Twitterbot/1.0"],
    note: "No operator page could be retrieved (developer.x.com blocks automated fetches); sourced from uap-core.",
  }),
  def({
    id: "linkedinbot", name: "LinkedInBot", category: "social-preview", operator: "LinkedIn", url: "https://www.linkedin.com",
    respectsRobotsTxt: undefined, sources: [reference(UAP)],
    examples: ["LinkedInBot/1.0 (compatible; Mozilla/5.0; Jakarta Commons-HttpClient/3.1 +http://www.linkedin.com)"],
    note: "No operator documentation found; sourced from uap-core.",
  }),
];

// ---------------------------------------------------------------- Monitoring / feeds / archivers
const misc: BotDefinition[] = [
  def({
    id: "uptimerobot", name: "UptimeRobot", category: "monitoring", operator: "UptimeRobot",
    url: "https://help.uptimerobot.com/en/articles/11358489", respectsRobotsTxt: undefined,
    sources: [operatorDoc("https://help.uptimerobot.com/en/articles/11358489")],
    examples: ["Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)"],
  }),
  def({
    id: "pingdom", name: "Pingdom", token: "pingdom", category: "monitoring", operator: "SolarWinds Pingdom", url: "https://www.pingdom.com",
    pattern: new RegExp(String.raw`\bPingdom(?:\.com_bot_version_|TMS/|PageSpeed/)${V}`),
    respectsRobotsTxt: undefined, sources: [reference(UAP)],
    examples: [
      "Pingdom.com_bot_version_1.4_(http://www.pingdom.com/)",
      "Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/534.34 (KHTML, like Gecko) PingdomTMS/0.8.5 Safari/534.34",
    ],
  }),
  def({
    id: "statuscake", name: "StatusCake", category: "monitoring", operator: "StatusCake", url: "https://www.statuscake.com",
    pattern: /\(StatusCake\)/, respectsRobotsTxt: undefined, sources: [reference(UAP)],
    examples: ["Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.4 (KHTML, like Gecko) Chrome/98 Safari/537.4 (StatusCake)"],
  }),
  def({
    id: "site24x7", name: "Site24x7", category: "monitoring", operator: "Zoho Site24x7", url: "https://www.site24x7.com",
    respectsRobotsTxt: undefined, sources: [reference(UAP)], examples: ["Site24x7"],
  }),
  def({
    id: "chrome-lighthouse", name: "Chrome-Lighthouse", category: "monitoring", operator: "Google (Lighthouse)",
    url: "https://github.com/GoogleChrome/lighthouse", respectsRobotsTxt: undefined, pattern: tok("Chrome-Lighthouse", false),
    sources: [operatorDoc("https://moz.com/help/moz-procedures/crawlers/dotbot")], examples: ["Chrome-Lighthouse"],
    note: "Lighthouse / PageSpeed audits append this token to an emulated browser UA.",
  }),
  def({
    id: "feedbin", name: "Feedbin", category: "feed-reader", operator: "Feedbin", url: "https://feedbin.com",
    pattern: /^Feedbin\b/, respectsRobotsTxt: undefined, sources: [reference(UAP)], examples: ["Feedbin feed-id:1033517 - 1000 subscribers"],
  }),
  def({
    id: "archive-org-bot", name: "archive.org_bot", category: "archiver", operator: "Internet Archive (Heritrix)",
    url: "https://github.com/internetarchive/heritrix3", pattern: /\barchive\.org_bot\b/i, respectsRobotsTxt: undefined,
    sources: [reference(UAP)],
    examples: ["Mozilla/5.0 (compatible; archive.org_bot/heritrix-1.15.1-x  http://pandora.nla.gov.au/crawl.html)"],
    note: "Heritrix's default token; also used by other archives running Heritrix.",
  }),
  def({
    id: "ia-archiver", name: "ia_archiver", category: "archiver", operator: "Alexa Internet (retired)", url: "https://archive.org",
    respectsRobotsTxt: undefined, sources: [reference(UAP)], examples: ["ia_archiver/8.7 (Windows NT 5.0; )"],
  }),
];

// ---------------------------------------------------------------- Security scanners
const scanners: BotDefinition[] = [
  def({
    id: "censysinspect", name: "CensysInspect", category: "security-scanner", operator: "Censys", url: "https://about.censys.io/",
    respectsRobotsTxt: undefined,
    sources: [operatorDoc("https://support.censys.io/hc/en-us/articles/360043177092-Opt-Out-of-Data-Collection")],
    examples: ["Mozilla/5.0 (compatible; CensysInspect/1.1; +https://about.censys.io/)"],
  }),
  def({
    id: "nmap", name: "Nmap Scripting Engine", token: "nmap scripting engine", category: "security-scanner", operator: "Nmap",
    url: "https://nmap.org/book/nse.html", pattern: /\bNmap Scripting Engine\b/, respectsRobotsTxt: undefined,
    sources: [sourceCode("https://github.com/nmap/nmap/blob/master/nselib/http.lua")],
    examples: ["Mozilla/5.0 (compatible; Nmap Scripting Engine; https://nmap.org/book/nse.html)"],
  }),
  def({
    id: "sqlmap", name: "sqlmap", category: "security-scanner", operator: "sqlmap project", url: "https://sqlmap.org",
    pattern: new RegExp(String.raw`\bsqlmap/${V}`), respectsRobotsTxt: undefined,
    sources: [sourceCode("https://github.com/sqlmapproject/sqlmap/blob/master/lib/core/settings.py")],
    examples: ["sqlmap/1.10.10#pip (https://sqlmap.org)"],
    note: "Example captured from sqlmap 1.10.10 (pip) against a local server on 2026-10-10.",
  }),
  def({
    id: "wpscan", name: "WPScan", category: "security-scanner", operator: "WPScan", url: "https://wpscan.com",
    pattern: new RegExp(String.raw`\bWPScan v${V}`), respectsRobotsTxt: undefined,
    sources: [sourceCode("https://github.com/wpscanteam/wpscan/blob/master/lib/wpscan/browser.rb")],
    examples: ["WPScan v3.8.25 (https://wpscan.com/wordpress-security-scanner)"],
    note: "Example follows the format in source (`WPScan v#{VERSION} (...)`); the version number is illustrative.",
  }),
];

// ---------------------------------------------------------------- Headless browsers
const headless: BotDefinition[] = [
  def({
    id: "headlesschrome", name: "HeadlessChrome", category: "headless-browser", operator: "Google (Chrome headless)",
    url: "https://developer.chrome.com/docs/chromium/headless", respectsRobotsTxt: undefined,
    sources: [reference(UAP)],
    examples: [
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_1) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/62.0.3202.89 Safari/537.36",
    ],
    note: "Puppeteer and Playwright drive Chrome headless with this UA by default; both can override it, and headful automation is indistinguishable by UA.",
  }),
  def({
    id: "phantomjs", name: "PhantomJS", category: "headless-browser", operator: "PhantomJS project", url: "https://phantomjs.org",
    respectsRobotsTxt: undefined, sources: [reference(UAP)],
    examples: ["Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/534.34 (KHTML, like Gecko) PhantomJS/1.6.0 Safari/534.34"],
  }),
];

// ---------------------------------------------------------------- HTTP libraries (default UAs from source)
// Examples of CAPTURED libraries were recorded from each client's default request
// against a local server on 2026-10-10; for the others the example follows the
// format in the cited source and the version number is illustrative.
const CAPTURED = new Set(["curl", "wget", "python-requests", "aiohttp", "httpx", "urllib3", "python-urllib", "go-http-client",
  "axios", "node-fetch", "undici", "node-fetch-builtin", "scrapy"]);
const lib = (
  id: string, name: string, token: string, pattern: RegExp, url: string, src: string, examples: string[], note?: string,
): BotDefinition =>
  def({
    id, name, token, pattern, category: "http-library", operator: name, url, respectsRobotsTxt: undefined,
    sources: [sourceCode(src)], examples,
    note: [note, CAPTURED.has(id) ? "Example captured from the default request (2026-10-10)." : "Example follows the source format; version illustrative."]
      .filter(Boolean).join(" "),
  });
const httpLibs: BotDefinition[] = [
  lib("curl", "curl", "curl/", new RegExp(String.raw`^curl/${V}`), "https://curl.se",
    "https://github.com/curl/curl/blob/master/docs/cmdline-opts/user-agent.md", ["curl/8.14.1"]),
  lib("wget", "Wget", "wget/", new RegExp(String.raw`^Wget/${V}`, "i"), "https://www.gnu.org/software/wget/",
    "https://www.gnu.org/software/wget/manual/wget.html", ["Wget/1.25.0"]),
  lib("python-requests", "python-requests", "python-requests/", new RegExp(String.raw`\bpython-requests/${V}`), "https://requests.readthedocs.io",
    "https://github.com/psf/requests/blob/main/src/requests/utils.py", ["python-requests/2.34.2"]),
  lib("aiohttp", "aiohttp", "aiohttp/", new RegExp(String.raw`\baiohttp/${V}`), "https://docs.aiohttp.org",
    "https://github.com/aio-libs/aiohttp/blob/master/aiohttp/http.py", ["Python/3.13 aiohttp/3.14.4"]),
  lib("httpx", "python-httpx", "python-httpx/", new RegExp(String.raw`\bpython-httpx/${V}`), "https://www.python-httpx.org",
    "https://github.com/encode/httpx/blob/master/httpx/_client.py", ["python-httpx/0.28.1"]),
  lib("urllib3", "python-urllib3", "python-urllib3/", new RegExp(String.raw`\bpython-urllib3/${V}`), "https://urllib3.readthedocs.io",
    "https://github.com/urllib3/urllib3/blob/main/src/urllib3/util/request.py", ["python-urllib3/2.8.0"]),
  lib("python-urllib", "Python-urllib", "python-urllib/", new RegExp(String.raw`\bPython-urllib/${V}`), "https://docs.python.org/3/library/urllib.request.html",
    "https://github.com/python/cpython/blob/main/Lib/urllib/request.py", ["Python-urllib/3.13"]),
  lib("go-http-client", "Go-http-client", "go-http-client/", new RegExp(String.raw`^Go-http-client/${V}`), "https://pkg.go.dev/net/http",
    "https://github.com/golang/go/blob/master/src/net/http/request.go", ["Go-http-client/1.1", "Go-http-client/2.0"]),
  lib("okhttp", "okhttp", "okhttp/", new RegExp(String.raw`\bokhttp/${V}`, "i"), "https://square.github.io/okhttp/",
    "https://github.com/square/okhttp/blob/parent-4.12.0/okhttp/src/main/kotlin/okhttp3/internal/Util.kt", ["okhttp/4.12.0"]),
  lib("axios", "axios", "axios/", new RegExp(String.raw`^axios/${V}`), "https://axios-http.com",
    "https://github.com/axios/axios/blob/v1.x/lib/adapters/http.js", ["axios/1.20.0"]),
  lib("node-fetch", "node-fetch", "node-fetch", new RegExp(String.raw`^node-fetch(?:/${V})?`), "https://github.com/node-fetch/node-fetch",
    "https://github.com/node-fetch/node-fetch/blob/main/src/request.js", ["node-fetch", "node-fetch/1.0 (+https://github.com/bitinn/node-fetch)"],
    "v3 sends the bare token; v2 sends `node-fetch/1.0 (+https://github.com/bitinn/node-fetch)`."),
  lib("undici", "undici", "undici", /^undici$/, "https://undici.nodejs.org",
    "https://github.com/nodejs/undici/blob/main/lib/web/fetch/index.js", ["undici"], "Standalone undici `fetch()` default."),
  lib("node-fetch-builtin", "Node.js fetch", "node", /^node$/, "https://nodejs.org/api/globals.html#fetch",
    "https://github.com/nodejs/undici/blob/main/lib/web/fetch/index.js", ["node"], "Node.js built-in `fetch()` (undici) sends exactly `node`."),
  lib("java-http-client", "Java-http-client", "java-http-client/", new RegExp(String.raw`^Java-http-client/${V}`), "https://openjdk.org/groups/net/httpclient/",
    "https://github.com/openjdk/jdk/blob/master/src/java.net.http/share/classes/jdk/internal/net/http/HttpRequestImpl.java", ["Java-http-client/21.0.4"]),
  lib("java", "Java", "java/", new RegExp(String.raw`^Java/${V}`), "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/net/HttpURLConnection.html",
    "https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/sun/net/www/protocol/http/HttpURLConnection.java", ["Java/1.8.0_412"]),
  lib("apache-httpclient", "Apache-HttpClient", "apache-httpclient/", new RegExp(String.raw`\bApache-HttpClient/${V}`), "https://hc.apache.org",
    "https://github.com/apache/httpcomponents-client/blob/master/httpclient5/src/main/java/org/apache/hc/client5/http/impl/classic/HttpClientBuilder.java",
    ["Apache-HttpClient/5.3.1 (Java/17.0.12)"]),
  lib("libwww-perl", "libwww-perl", "libwww-perl/", new RegExp(String.raw`\blibwww-perl/${V}`), "https://metacpan.org/pod/LWP::UserAgent",
    "https://github.com/libwww-perl/libwww-perl/blob/master/lib/LWP/UserAgent.pm", ["libwww-perl/6.77"]),
  lib("guzzle", "GuzzleHttp", "guzzlehttp/", new RegExp(String.raw`\bGuzzleHttp/${V}`), "https://docs.guzzlephp.org",
    "https://github.com/guzzle/guzzle/blob/7.9/src/Utils.php", ["GuzzleHttp/7"]),
  lib("scrapy", "Scrapy", "scrapy/", new RegExp(String.raw`\bScrapy/${V}`), "https://scrapy.org",
    "https://github.com/scrapy/scrapy/blob/master/scrapy/settings/default_settings.py", ["Scrapy/2.19.0 (+https://scrapy.org)"]),
  lib("postman", "PostmanRuntime", "postmanruntime/", new RegExp(String.raw`\bPostmanRuntime/${V}`), "https://www.postman.com",
    "https://github.com/postmanlabs/postman-runtime/blob/develop/lib/requester/core.js", ["PostmanRuntime/7.42.0"]),
];

/**
 * All known agents, in matching order. Treat as read-only data; entries and
 * arrays are frozen.
 */
export const BOT_DEFINITIONS: readonly BotDefinition[] = Object.freeze(
  [...openai, ...anthropic, ...google, ...aiOthers, ...search, ...yandex, ...seo, ...social, ...misc, ...scanners, ...headless, ...httpLibs].map(
    (d) => Object.freeze({ ...d, sources: Object.freeze([...d.sources]), examples: Object.freeze([...d.examples]) }),
  ),
);

/** robots.txt-only product tokens: they control data use but never appear in a request's User-Agent. */
export interface RobotsOnlyToken {
  token: string;
  operator: string;
  purpose: string;
  source: BotSource;
}

export const ROBOTS_ONLY_TOKENS: readonly RobotsOnlyToken[] = Object.freeze([
  Object.freeze({
    token: "Google-Extended", operator: "Google",
    purpose: "Opt out of content use for training / grounding Gemini models; crawling is done by other Google agents.",
    source: operatorDoc(G_COMMON),
  }),
  Object.freeze({
    token: "Googlebot-News", operator: "Google",
    purpose: "Controls Google News; crawling is done with the Googlebot user agents.",
    source: operatorDoc(G_COMMON),
  }),
  Object.freeze({
    token: "Applebot-Extended", operator: "Apple",
    purpose: "Opt out of content use for training Apple foundation models; Applebot-Extended does not crawl.",
    source: operatorDoc(APPLE_DOC),
  }),
]);
