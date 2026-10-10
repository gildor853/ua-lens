export { parse, parseHeaders, isMobile } from "./parse.js";
export { detectBot, isBot, isAiBot, type DetectBotOptions } from "./bots.js";
export { normalize, normalizeResult, type NormalizedUa } from "./normalize.js";
export {
  verifyBotDns,
  getVerificationHint,
  ipInCidrs,
  cidrsFromIpRanges,
  type DnsResolvers,
  type DnsVerification,
} from "./verify.js";
export { isGreaseBrand } from "./hints.js";
export { BOT_DEFINITIONS, ROBOTS_ONLY_TOKENS, type BotDefinition, type BotSource, type RobotsOnlyToken } from "./data/bots.js";
export { verifyBotHints, type BotVerificationHint, type VerificationMethod } from "./data/verification.js";
export { DEFAULT_MAX_LENGTH } from "./input.js";
export { parseSfList, parseSfDictionary, parseSfItem } from "./sfv.js";
export type {
  SfBareItem,
  SfBinary,
  SfDate,
  SfDecimal,
  SfDictionary,
  SfDisplayString,
  SfInnerList,
  SfItem,
  SfMember,
  SfParams,
  SfToken,
} from "./sfv.js";
export { UaLensError, isUaLensError, type UaLensErrorCode } from "./errors.js";
export type * from "./types.js";
