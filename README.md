# ua-lens

Provided as is, without warranty — see [DISCLAIMER.md](./DISCLAIMER.md).

User-Agent parsing, normalisation and bot detection for TypeScript and
JavaScript, with no runtime dependencies.

- Identifies browser, engine, OS, device and CPU from a User-Agent string, and
  from [User-Agent Client Hints](https://wicg.github.io/ua-client-hints/) when
  you have them.
- Treats Chromium's reduced UA and other frozen values (`Chrome/143.0.0.0`,
  `Windows NT 10.0`, `Android 10; K`, `Mac OS X 10_15_7`, iOS 18.6 under
  Safari 26) as unknown instead of reporting them as facts, and says so.
- Recognises known crawlers, fetchers and tools in 13 categories, including
  AI crawlers, assistants and AI search agents. Every entry cites the
  page its token comes from; AI agents only appear if the operator documents
  them.
- Ships the operators' documented verification methods (reverse DNS suffixes,
  IP range lists) and a DNS helper that takes your resolver, so the core never
  touches the network.
- Ordered, data-driven regex tables; every regex is bounded and checked for
  catastrophic backtracking; input is capped at 2048 characters by default.

## Install

Not published to npm. Install a tagged release from GitHub:

```sh
npm install github:gildor853/ua-lens#v1.0.0
```

ESM and CommonJS builds with type declarations. Node.js 18 or newer, or any
modern browser / edge runtime.

## Quick start

```ts
import { detectBot, isAiBot, isMobile, normalize, parse } from "ua-lens";

const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

const r = parse(ua);
r.browser; // { name: "Chrome", version: undefined, major: "143", reportedVersion: "143.0.0.0", engine: { name: "Blink" } }
r.os; // { name: "Windows", version: undefined, reportedVersion: "10.0", family: "windows" }
r.device.type; // "desktop"
r.reduced; // true
r.frozen; // ["browser.version", "os.version", "cpu.architecture"]
r.confidence; // "medium"

normalize(ua).label; // "Chrome 143 / Windows 10+ / desktop"
normalize(ua).id; // "chrome-143:windows-10+:desktop"

isMobile("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36"); // true

const gpt = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot";
detectBot(gpt); // { isBot: true, category: "ai-crawler", name: "GPTBot", version: "1.4", operator: "OpenAI", respectsRobotsTxt: true, verification: "openai-gptbot" }
isAiBot(gpt); // true
```

## API

### `parse(ua, options?)`

`ua` is a string, or `null` / `undefined` for a missing header. Options:

- `hints`: Client Hints, as a header record (`{ "sec-ch-ua": "…" }`, any
  case, string or string-array values), a Fetch `Headers` object, or the
  object returned by `navigator.userAgentData.getHighEntropyValues()`.
- `maxLength`: cap for the UA and each hint value (default 2048). Longer input
  is truncated and `truncated` is set.

Returns a plain, JSON-serialisable `ParseResult`:

| Field | Meaning |
| --- | --- |
| `browser` | `name`, `version` (full, `undefined` when frozen), `major`, `reportedVersion` (as written in the UA), `engine` (`Blink`, `WebKit`, `Gecko`, `EdgeHTML`, `Trident`, `Presto`), `inApp`, `webview` |
| `os` | `name`, `version`, `reportedVersion`, `family` (`windows`, `apple`, `android`, `linux`, `chromeos`, `bsd`, `other`) |
| `device` | `type` (`desktop`, `mobile`, `tablet`, `tv`, `console`, `wearable`, `xr`, `embedded`, `bot`, `unknown`), `vendor`, `model`, `reportedModel` |
| `cpu` | `architecture` (`amd64`, `ia32`, `arm64`, `arm`, `x86`) when known |
| `bot` | the `detectBot` result |
| `reduced` | the UA is a Chromium reduced UA (`Chrome/<major>.0.0.0`, major ≥ 100) |
| `frozen` | fields whose UA value is a known placeholder: `browser.version`, `os.version`, `device.model`, `cpu.architecture` |
| `confidence` | `high`, `medium` (something is frozen or the OS is unknown) or `low` (browser unknown) |
| `hints` | `used`, `applied` (fields the hints changed), `invalid` (headers that failed to parse), `brands` (GREASE removed) |

Browser names are canonical: `Chrome`, `Chrome Mobile`, `Chrome WebView`,
`Edge`, `Edge Legacy` (EdgeHTML 12–18), `Firefox`, `Safari`, `Mobile Safari`,
`Samsung Internet`, `Opera`, `Opera Mini`, `Yandex Browser`, `Brave`,
`Vivaldi`, `WKWebView`, `Android Browser`, in-app browsers (`Facebook`,
`Instagram`, `TikTok`, `LinkedIn`, `WeChat`, `LINE`), `Headless Chrome` and
others. iPadOS is reported as `iOS` with `device.type: "tablet"`.

### `parseHeaders(headers, options?)`

Reads `User-Agent` and the `Sec-CH-UA-*` headers from one request:

```ts
import { parseHeaders } from "ua-lens";

// Captured from Chrome (headless) after the server sent Accept-CH for every hint.
const r = parseHeaders({
  "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36",
  "sec-ch-ua": '"Chromium";v="154", "Google Chrome";v="154", "Not A(Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Linux"',
  "sec-ch-ua-arch": '"x86"',
  "sec-ch-ua-bitness": '"64"',
  "sec-ch-ua-full-version-list": '"Chromium";v="154.0.8037.57", "Google Chrome";v="154.0.8037.57", "Not A(Brand";v="99.0.0.0"',
});
r.browser.version; // "154.0.8037.57"
r.cpu.architecture; // "amd64"
r.frozen; // []
r.bot.category; // "headless-browser"
r.hints.brands; // [{ brand: "Chromium", version: "154.0.8037.57" }, { brand: "Google Chrome", version: "154.0.8037.57" }]
```

### `detectBot(ua, options?)`, `isBot(ua)`, `isAiBot(ua)`

`detectBot` returns `{ isBot, category, name, version, operator, url,
respectsRobotsTxt, verification, generic }`. Known agents come from the table
below. Anything else that looks automated (a `…bot` / `crawler` / `spider` /
`scraper` word, or a URL in the UA) is reported with `category: "other"` and
`generic: true`.

`isAiBot` is true for the `ai-crawler`, `ai-assistant` and `ai-search`
categories. These are different things: `ai-crawler` collects training data,
`ai-search` indexes pages for an AI search product, and `ai-assistant`
fetches a page because a person asked an assistant to. Operators usually say
the last kind ignores robots.txt, since a user initiated it.

```ts
import { detectBot } from "ua-lens";

detectBot("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot").category; // "ai-assistant"
detectBot("Mozilla/5.0 (compatible; SeznamBot/4.0; +https://o-seznam.cz/napoveda/vyhledavani/en/seznambot-crawler/)").name; // "SeznamBot"
detectBot("curl/8.14.1"); // { isBot: true, category: "http-library", name: "curl", version: "8.14.1" }
detectBot("MyCoolCrawler/1.0"); // { isBot: true, category: "other", name: "MyCoolCrawler", generic: true }
```

### `normalize(ua, options?)` / `normalizeResult(result)`

A compact, stable form for logs and analytics: `label`, `id`, `browser`,
`browserMajor`, `os`, `osVersion`, `device`, `bot`. Versions are coarse on
purpose (browser major, OS major; Windows 10 and 11 share `10+` unless a hint
says otherwise).

```ts
import { normalize } from "ua-lens";

normalize("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36", {
  hints: { "sec-ch-ua-platform": '"Windows"', "sec-ch-ua-platform-version": '"15.0.0"' },
}).label; // "Chrome 143 / Windows 11 / desktop"
normalize("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)").label; // "Googlebot 2.1 / bot (search-engine)"
```

### Verification: `verifyBotHints`, `getVerificationHint`, `verifyBotDns`, `ipInCidrs`, `cidrsFromIpRanges`

See [Spoofing and verification](#spoofing-and-verification).

### Other exports

- `BOT_DEFINITIONS`: the frozen bot table (tokens, patterns, sources, examples).
- `ROBOTS_ONLY_TOKENS`: robots.txt product tokens that never appear in a UA
  (`Google-Extended`, `Googlebot-News`, `Applebot-Extended`), so a crawler
  cannot be detected by them.
- `isGreaseBrand(brand)`, and the RFC 9651 structured-field parsers
  `parseSfList`, `parseSfDictionary`, `parseSfItem` used for the hint headers.
- `UaLensError` / `isUaLensError`: thrown for a non-string UA
  (`InvalidInput`) or bad options (`InvalidOption`). Unparseable UAs never
  throw; they return unknown fields and `confidence: "low"`.

## Reduced and frozen User-Agents

Chromium (since Chrome 110), Safari and Firefox now send placeholder values in
parts of the UA string:

| UA says | Means | ua-lens reports |
| --- | --- | --- |
| `Chrome/143.0.0.0` | major version only | `major: "143"`, `version: undefined`, `browser.version` frozen |
| `Windows NT 10.0` | Windows 10 **or 11** | `os.version: undefined`, `os.version` frozen |
| `Win64; x64`, `X11; Linux x86_64` in a reduced UA | not necessarily the real CPU | `cpu.architecture` frozen |
| `Android 10; K` | any Android version, any device | `os.version` and `device.model` frozen |
| `Mac OS X 10_15_7` (`10.15` in Firefox) | any macOS since Catalina | `os.version` frozen |
| `Intel Mac OS X` | also sent by Apple silicon Macs | `cpu.architecture` frozen |
| `iPhone OS 18_6` with Safari `Version/26` or later | iOS 26+ (iOS freezes at 18.6/18.7) | `os.version` frozen |
| `CrOS x86_64 14541.0.0` in a reduced UA | fixed platform version | `os.version` frozen |

The value as written is always kept in `reportedVersion` / `reportedModel`.

## Client Hints

Chromium-based browsers send `Sec-CH-UA`, `Sec-CH-UA-Mobile` and
`Sec-CH-UA-Platform` by default. The rest must be requested with
`Accept-CH` (and are only sent on later requests, or on a retry if you also
use `Critical-CH`):

```http
Accept-CH: Sec-CH-UA-Platform-Version, Sec-CH-UA-Full-Version-List, Sec-CH-UA-Arch, Sec-CH-UA-Bitness, Sec-CH-UA-Model, Sec-CH-UA-Form-Factors
Vary: Sec-CH-UA-Platform-Version, Sec-CH-UA-Full-Version-List
```

How hints are used:

- Each header is parsed as an RFC 9651 structured field; a malformed header is
  ignored and listed in `hints.invalid`.
- GREASE brands (`"Not A(Brand"`, `";Not?A.Brand"`, …) are dropped. A
  specific brand (`Microsoft Edge`, `Opera`, `Brave`, …) wins over `Google
  Chrome`, which wins over `Chromium`.
- `Sec-CH-UA-Platform-Version` on Windows maps `13.0.0` and up to Windows 11,
  `1`–`10` to Windows 10 and `0.1`/`0.2`/`0.3` to 7/8/8.1, following
  [Microsoft's guidance](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/how-to-detect-win11).
- Hints override the matching frozen UA fields, and every change is listed in
  `hints.applied`. Placeholder versions in the full version list
  (`143.0.0.0`) are not treated as full versions.

**Brave** sends the same UA as Chrome. It can only be told apart by its
`"Brave"` brand in `Sec-CH-UA` (or `navigator.brave` in the page). Without
hints it is reported as Chrome, except where Brave adds its own token (iOS).

## Bots and AI agents

<!-- bot-stats:start -->
152 entries, 26 of them AI agents from 11 operators.
They cite 53 distinct pages: 30 operator documentation pages,
22 source files or manuals (HTTP libraries and tools)
and 1 reference corpus (uap-core, used for 10 agents without an official page),
retrieved on 2026-10-10.
<!-- bot-stats:end -->

Left out on purpose because no current operator documentation lists them as
active: `anthropic-ai`, `Claude-Web`, `FacebookBot`, `cohere-ai`,
`Timpibot`, `Bytespider`, `TelegramBot`. Generic detection still flags most
of them as `other`.

<!-- bots:start -->
| Name | Category | Operator | robots.txt | Verify | Source |
| --- | --- | --- | --- | --- | --- |
| OAI-SearchBot | ai-search | OpenAI | yes | `openai-searchbot` | [operator docs](https://platform.openai.com/docs/bots) |
| OAI-AdsBot | other | OpenAI | – | `openai-adsbot` | [operator docs](https://platform.openai.com/docs/bots) |
| GPTBot | ai-crawler | OpenAI | yes | `openai-gptbot` | [operator docs](https://platform.openai.com/docs/bots) |
| ChatGPT-User | ai-assistant | OpenAI | no | `openai-chatgpt-user` | [operator docs](https://platform.openai.com/docs/bots) |
| Claude-SearchBot | ai-search | Anthropic | yes | `anthropic` | [operator docs](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) |
| Claude-User | ai-assistant | Anthropic | yes | `anthropic` | [operator docs](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) |
| ClaudeBot | ai-crawler | Anthropic | yes | `anthropic` | [operator docs](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) |
| AdsBot-Google-Mobile | other | Google | no | `google-special` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-special-case-crawlers) |
| AdsBot-Google | other | Google | no | `google-special` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-special-case-crawlers) |
| APIs-Google | other | Google | no | `google-special` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-special-case-crawlers) |
| Mediapartners-Google | other | Google | no | `google-special` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-special-case-crawlers) |
| Google-Safety | security-scanner | Google | no | `google-special` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-special-case-crawlers) |
| Googlebot-Image | search-engine | Google | yes | `google-common` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) |
| Googlebot-Video | search-engine | Google | yes | `google-common` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) |
| Storebot-Google | search-engine | Google | yes | `google-common` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) |
| Google-InspectionTool | search-engine | Google | yes | `google-common` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) |
| GoogleOther-Image | other | Google | yes | `google-common` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) |
| GoogleOther-Video | other | Google | yes | `google-common` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) |
| GoogleOther | other | Google | yes | `google-common` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) |
| Google-CloudVertexBot | ai-crawler | Google | yes | `google-common` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) |
| Googlebot | search-engine | Google | yes | `google-common` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) |
| Google-GeminiNotebook | ai-assistant | Google | no | `google-user` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers) |
| Google-NotebookLM | ai-assistant | Google | no | `google-user` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers) |
| Google-Agent | ai-assistant | Google | no | `google-user` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers) |
| Google-Read-Aloud | other | Google | no | `google-user` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers) |
| FeedFetcher-Google | feed-reader | Google | no | `google-user` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers) |
| GoogleProducer | feed-reader | Google | no | `google-user` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers) |
| Google-CWS | other | Google | no | `google-user` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers) |
| GoogleMessages | social-preview | Google | no | `google-user` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers) |
| Google-Pinpoint | other | Google | no | `google-user` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers) |
| Google-Site-Verification | other | Google | no | `google-user` | [operator docs](https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers) |
| Perplexity-User | ai-assistant | Perplexity | no | `perplexity-user` | [operator docs](https://docs.perplexity.ai/guides/bots) |
| PerplexityBot | ai-search | Perplexity | yes | `perplexitybot` | [operator docs](https://docs.perplexity.ai/guides/bots) |
| meta-externalagent | ai-crawler | Meta | yes | `meta` | [operator docs](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers) |
| meta-externalfetcher | ai-assistant | Meta | no | `meta` | [operator docs](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers) |
| meta-webindexer | ai-search | Meta | yes | `meta` | [operator docs](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers) |
| meta-externalads | other | Meta | yes | `meta` | [operator docs](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers) |
| Amazonbot | ai-crawler | Amazon | yes | `amazonbot` | [operator docs](https://developer.amazon.com/amazonbot) |
| Amzn-SearchBot | ai-search | Amazon | yes | `amzn-searchbot` | [operator docs](https://developer.amazon.com/amazonbot) |
| Amzn-User | ai-assistant | Amazon | no | `amzn-user` | [operator docs](https://developer.amazon.com/amazonbot) |
| CCBot | ai-crawler | Common Crawl | yes | `commoncrawl` | [operator docs](https://commoncrawl.org/ccbot) |
| MistralAI-User | ai-assistant | Mistral AI | yes | `mistralai-user` | [operator docs](https://docs.mistral.ai/robots) |
| MistralAI-Index | ai-search | Mistral AI | yes | `mistralai-index` | [operator docs](https://docs.mistral.ai/robots) |
| MistralAI-Training | ai-crawler | Mistral AI | yes | – | [operator docs](https://docs.mistral.ai/robots) |
| DuckAssistBot | ai-search | DuckDuckGo | yes | `duckassistbot` | [operator docs](https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot) |
| YouBot | ai-search | You.com | yes | `youbot` | [operator docs](https://docs.you.com/youbot) |
| ImagesiftBot | other | ImageSift | yes | – | [operator docs](https://imagesift.com/about) |
| BingVideoPreview | search-engine | Microsoft | – | `bing` | [operator docs](https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0) |
| MicrosoftPreview | social-preview | Microsoft | – | `bing` | [operator docs](https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0) |
| adidxbot | other | Microsoft | yes | `bing` | [operator docs](https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0) |
| bingbot | search-engine | Microsoft | yes | `bing` | [operator docs](https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0) |
| Applebot | search-engine | Apple | yes | `apple` | [operator docs](https://support.apple.com/en-us/119829) |
| DuckDuckBot | search-engine | DuckDuckGo | yes | `duckduckbot` | [operator docs](https://duckduckgo.com/duckduckgo-help-pages/results/duckduckbot) |
| Baiduspider | search-engine | Baidu | yes | `baidu` | [operator docs](https://help.baidu.com/question?prod_id=99&class=476&id=2996) |
| SeznamBot | search-engine | Seznam.cz | yes | `seznam` | [operator docs](https://napoveda.seznam.cz/en/full-text-search/seznambot-crawler/) |
| Diffbot-User | other | Diffbot | – | – | [operator docs](https://www.diffbot.com/docs/crawl/faq/robots-txt) |
| Diffbot | search-engine | Diffbot | yes | – | [operator docs](https://www.diffbot.com/docs/crawl/faq/robots-txt) |
| YandexAccessibilityBot | monitoring | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexAdNet | other | Yandex | yes | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexAdditionalBot | ai-search | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexAdditional | ai-search | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexBlogs | search-engine | Yandex | yes | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexCalendar | other | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexCheckBot | monitoring | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexComBot | search-engine | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexDirectDyn | other | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexDirect | other | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YaDirectFetcher | other | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexFavicons | search-engine | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexFeed | feed-reader | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexImageResizer | search-engine | Yandex | yes | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexImages | search-engine | Yandex | yes | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexMarket | search-engine | Yandex | yes | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexMedia | search-engine | Yandex | yes | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexMetrika | monitoring | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexMobileBot | search-engine | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexMobileScreenShotBot | other | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexOntoDBAPI | search-engine | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexOntoDB | search-engine | Yandex | yes | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexPagechecker | seo | Yandex | yes | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexPartner | other | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexRCA | social-preview | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexRenderResourcesBot | search-engine | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexScreenshotBot | other | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexSearchShop | feed-reader | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexSitelinks | search-engine | Yandex | yes | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexSpravBot | search-engine | Yandex | yes | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexTracker | other | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexUserproxy | other | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexVerticals | search-engine | Yandex | yes | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexVertis | search-engine | Yandex | yes | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexVideoParser | search-engine | Yandex | no | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexVideo | search-engine | Yandex | yes | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexWebmaster | seo | Yandex | yes | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| YandexBot | search-engine | Yandex | yes | `yandex` | [operator docs](https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html) |
| AhrefsSiteAudit | seo | Ahrefs | yes | `ahrefs` | [operator docs](https://ahrefs.com/robot) |
| AhrefsBot | seo | Ahrefs | yes | `ahrefs` | [operator docs](https://ahrefs.com/robot) |
| SemrushBot-BA | seo | Semrush | yes | – | [operator docs](https://www.semrush.com/bot/) |
| SemrushBot-SI | seo | Semrush | yes | – | [operator docs](https://www.semrush.com/bot/) |
| SemrushBot-SWA | seo | Semrush | yes | – | [operator docs](https://www.semrush.com/bot/) |
| SemrushBot-OCOB | seo | Semrush | yes | – | [operator docs](https://www.semrush.com/bot/) |
| SemrushBot-FT | seo | Semrush | yes | – | [operator docs](https://www.semrush.com/bot/) |
| SemrushBot-ESI | seo | Semrush | yes | – | [operator docs](https://www.semrush.com/bot/) |
| SemrushBot | seo | Semrush | yes | – | [operator docs](https://www.semrush.com/bot/) |
| SiteAuditBot | seo | Semrush | yes | – | [operator docs](https://www.semrush.com/bot/) |
| SplitSignalBot | seo | Semrush | yes | – | [operator docs](https://www.semrush.com/bot/) |
| MJ12bot | seo | Majestic | yes | – | [operator docs](https://mj12bot.com/) |
| DotBot | seo | Moz | yes | – | [operator docs](https://moz.com/help/moz-procedures/crawlers/dotbot) |
| rogerbot | seo | Moz | yes | – | [operator docs](https://moz.com/help/moz-procedures/crawlers/dotbot) |
| facebookexternalhit | social-preview | Meta | yes | `meta` | [operator docs](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers) |
| WhatsApp | social-preview | Meta | – | – | [operator docs](https://developers.facebook.com/docs/whatsapp/link-previews/) |
| Slackbot-LinkExpanding | social-preview | Slack | – | – | [operator docs](https://api.slack.com/robots) |
| Slackbot | social-preview | Slack | – | – | [operator docs](https://api.slack.com/robots) |
| Discordbot | social-preview | Discord | – | `discord` | [operator docs](https://support.discord.com/hc/en-us/articles/42500550752919) |
| Pinterestbot | social-preview | Pinterest | yes | `pinterest` | [operator docs](https://help.pinterest.com/en/business/article/pinterest-crawler) |
| Pinterest | social-preview | Pinterest | yes | `pinterest` | [operator docs](https://help.pinterest.com/en/business/article/pinterest-crawler) |
| Twitterbot | social-preview | X (Twitter) | – | – | [uap-core](https://github.com/ua-parser/uap-core/blob/master/tests/test_ua.yaml) |
| LinkedInBot | social-preview | LinkedIn | – | – | [uap-core](https://github.com/ua-parser/uap-core/blob/master/tests/test_ua.yaml) |
| UptimeRobot | monitoring | UptimeRobot | – | – | [operator docs](https://help.uptimerobot.com/en/articles/11358489) |
| Pingdom | monitoring | SolarWinds Pingdom | – | – | [uap-core](https://github.com/ua-parser/uap-core/blob/master/tests/test_ua.yaml) |
| StatusCake | monitoring | StatusCake | – | – | [uap-core](https://github.com/ua-parser/uap-core/blob/master/tests/test_ua.yaml) |
| Site24x7 | monitoring | Zoho Site24x7 | – | – | [uap-core](https://github.com/ua-parser/uap-core/blob/master/tests/test_ua.yaml) |
| Chrome-Lighthouse | monitoring | Google (Lighthouse) | – | – | [operator docs](https://moz.com/help/moz-procedures/crawlers/dotbot) |
| Feedbin | feed-reader | Feedbin | – | – | [uap-core](https://github.com/ua-parser/uap-core/blob/master/tests/test_ua.yaml) |
| archive.org_bot | archiver | Internet Archive (Heritrix) | – | – | [uap-core](https://github.com/ua-parser/uap-core/blob/master/tests/test_ua.yaml) |
| ia_archiver | archiver | Alexa Internet (retired) | – | – | [uap-core](https://github.com/ua-parser/uap-core/blob/master/tests/test_ua.yaml) |
| CensysInspect | security-scanner | Censys | – | – | [operator docs](https://support.censys.io/hc/en-us/articles/360043177092-Opt-Out-of-Data-Collection) |
| Nmap Scripting Engine | security-scanner | Nmap | – | – | [source](https://github.com/nmap/nmap/blob/master/nselib/http.lua) |
| sqlmap | security-scanner | sqlmap project | – | – | [source](https://github.com/sqlmapproject/sqlmap/blob/master/lib/core/settings.py) |
| WPScan | security-scanner | WPScan | – | – | [source](https://github.com/wpscanteam/wpscan/blob/master/lib/wpscan/browser.rb) |
| HeadlessChrome | headless-browser | Google (Chrome headless) | – | – | [uap-core](https://github.com/ua-parser/uap-core/blob/master/tests/test_ua.yaml) |
| PhantomJS | headless-browser | PhantomJS project | – | – | [uap-core](https://github.com/ua-parser/uap-core/blob/master/tests/test_ua.yaml) |
| curl | http-library | curl | – | – | [source](https://github.com/curl/curl/blob/master/docs/cmdline-opts/user-agent.md) |
| Wget | http-library | Wget | – | – | [source](https://www.gnu.org/software/wget/manual/wget.html) |
| python-requests | http-library | python-requests | – | – | [source](https://github.com/psf/requests/blob/main/src/requests/utils.py) |
| aiohttp | http-library | aiohttp | – | – | [source](https://github.com/aio-libs/aiohttp/blob/master/aiohttp/http.py) |
| python-httpx | http-library | python-httpx | – | – | [source](https://github.com/encode/httpx/blob/master/httpx/_client.py) |
| python-urllib3 | http-library | python-urllib3 | – | – | [source](https://github.com/urllib3/urllib3/blob/main/src/urllib3/util/request.py) |
| Python-urllib | http-library | Python-urllib | – | – | [source](https://github.com/python/cpython/blob/main/Lib/urllib/request.py) |
| Go-http-client | http-library | Go-http-client | – | – | [source](https://github.com/golang/go/blob/master/src/net/http/request.go) |
| okhttp | http-library | okhttp | – | – | [source](https://github.com/square/okhttp/blob/parent-4.12.0/okhttp/src/main/kotlin/okhttp3/internal/Util.kt) |
| axios | http-library | axios | – | – | [source](https://github.com/axios/axios/blob/v1.x/lib/adapters/http.js) |
| node-fetch | http-library | node-fetch | – | – | [source](https://github.com/node-fetch/node-fetch/blob/main/src/request.js) |
| undici | http-library | undici | – | – | [source](https://github.com/nodejs/undici/blob/main/lib/web/fetch/index.js) |
| Node.js fetch | http-library | Node.js fetch | – | – | [source](https://github.com/nodejs/undici/blob/main/lib/web/fetch/index.js) |
| Java-http-client | http-library | Java-http-client | – | – | [source](https://github.com/openjdk/jdk/blob/master/src/java.net.http/share/classes/jdk/internal/net/http/HttpRequestImpl.java) |
| Java | http-library | Java | – | – | [source](https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/sun/net/www/protocol/http/HttpURLConnection.java) |
| Apache-HttpClient | http-library | Apache-HttpClient | – | – | [source](https://github.com/apache/httpcomponents-client/blob/master/httpclient5/src/main/java/org/apache/hc/client5/http/impl/classic/HttpClientBuilder.java) |
| libwww-perl | http-library | libwww-perl | – | – | [source](https://github.com/libwww-perl/libwww-perl/blob/master/lib/LWP/UserAgent.pm) |
| GuzzleHttp | http-library | GuzzleHttp | – | – | [source](https://github.com/guzzle/guzzle/blob/7.9/src/Utils.php) |
| Scrapy | http-library | Scrapy | – | – | [source](https://github.com/scrapy/scrapy/blob/master/scrapy/settings/default_settings.py) |
| PostmanRuntime | http-library | PostmanRuntime | – | – | [source](https://github.com/postmanlabs/postman-runtime/blob/develop/lib/requester/core.js) |
<!-- bots:end -->

## Spoofing and verification

Anyone can send any User-Agent. A request that says `Googlebot` is a claim,
not a fact, so do not grant crawler-only access (skipping a paywall, rate
limits or bot challenges) on the UA alone. Use the operator's verification
method:

- **Reverse DNS**: look up the PTR record of the client IP, check that the
  host ends with one of the operator's domains, then resolve that host forward
  and check that it returns the same IP.
- **IP ranges**: compare the client IP with the operator's published list.

`verifyBotHints` holds the documented method per operator; `getVerificationHint`
looks it up from a UA or a `detectBot` result.

```ts
import { cidrsFromIpRanges, getVerificationHint, ipInCidrs } from "ua-lens";

const hint = getVerificationHint("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot");
hint?.method; // "ip-ranges"
hint?.ipRanges; // ["https://openai.com/gptbot.json"]

// Fetch and cache the list yourself; ua-lens does not make network calls.
const json = { prefixes: [{ ipv4Prefix: "192.0.2.0/24" }, { ipv6Prefix: "2001:db8::/32" }] };
ipInCidrs("192.0.2.17", cidrsFromIpRanges(json)); // true
ipInCidrs("::ffff:192.0.2.17", cidrsFromIpRanges(json)); // true
```

`verifyBotDns` performs the forward-confirmed reverse DNS check with resolvers
you inject, so it works with `node:dns`, DNS over HTTPS or a cache:

<!-- readme-check: skip (performs real DNS lookups) -->
```ts
import { promises as dns } from "node:dns";
import { verifyBotDns } from "ua-lens";

const resolvers = {
  reverse: (ip: string) => dns.reverse(ip),
  forward: async (host: string) => {
    const [v4, v6] = await Promise.allSettled([dns.resolve4(host), dns.resolve6(host)]);
    return [...(v4.status === "fulfilled" ? v4.value : []), ...(v6.status === "fulfilled" ? v6.value : [])];
  },
};

const result = await verifyBotDns("66.249.66.1", req.headers["user-agent"], resolvers);
// { verified: true, hostname: "crawl-66-249-66-1.googlebot.com", reason: "ok", hint: {...} }
```

`reason` is one of `ok`, `unknown-bot`, `no-dns-method` (the operator only
publishes IP ranges, or nothing), `invalid-ip`, `no-ptr`, `domain-mismatch`,
`forward-mismatch` and `lookup-failed`. A runnable version is in
[`examples/verify-dns.mjs`](./examples/verify-dns.mjs). Cache the results;
DNS lookups are slow, and the check is only needed for requests that claim to
be a crawler.

Anthropic and Meta do not publish a verification method; their hints say so
(`method: "none"`).

## Security notes

- Input longer than `maxLength` (default 2048) is truncated before any regex
  runs. Every regex in the package uses bounded quantifiers and no nested
  repetition, enforced by a static check in the test suite and a fuzz test with
  adversarial 2048-character inputs.
- Header records are read with own-property checks only; `__proto__` and
  inherited keys are ignored, and the exported data tables are frozen.
- `parse` and `detectBot` are pure and synchronous. Only `verifyBotDns` is
  asynchronous, and only through the resolvers you pass in.

## Limitations

- UA strings are self-reported and often wrong on purpose: browsers impersonate
  each other, privacy tools rewrite them and bots copy browser UAs. Treat the
  result as a hint.
- iPadOS Safari requests the desktop site by default and sends a macOS UA, so
  most iPads are reported as a Mac. Apple Vision Pro does the same. Only
  JavaScript (touch support) can tell them apart.
- Without Client Hints, Windows 10 and 11, Android versions and models in
  reduced UAs, and macOS versions after 10.15 are unknown.
- Bot detection by UA only finds agents that announce themselves. Headless
  browsers driven by Puppeteer or Playwright are only detected while they keep
  the `HeadlessChrome` token.
- The bot table reflects the operators' documentation on 2026-10-10. Tokens
  change; check the linked sources if a decision depends on them.
- Device vendors and models are recognised for common brands only; the model
  string is returned as found.

## Testing

The test suite uses real UA strings only, each with a cited source: MDN,
Chromium and Microsoft documentation, the operators' bot pages, captures from
locally run tools (curl, Wget, Python and Node.js HTTP clients, Scrapy,
sqlmap, headless Chrome), and the
[ua-parser/uap-core](https://github.com/ua-parser/uap-core) test corpus
(17,816 strings, Apache-2.0) for robustness. The structured-field parser runs
the official [httpwg/structured-field-tests](https://github.com/httpwg/structured-field-tests).

## Disclaimer

**Use at your own risk.** This software is provided as is, without warranty of any kind. Identifications can be wrong; User-Agent strings can be forged. Do not use it as the sole basis for access control. See the full legal text in [DISCLAIMER.md](./DISCLAIMER.md).

## Contributing

This repository is maintained by a single author and does not accept external
contributions; issues and pull requests are limited to collaborators.

Security problems can be reported privately, see [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © 2026 Gildor

The test fixtures under `test/fixtures/` keep their own licenses (see the
`LICENSE` / `SOURCE.md` files there).
