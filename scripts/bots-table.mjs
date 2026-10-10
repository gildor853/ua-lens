// Generates the bot statistics and table in README.md from BOT_DEFINITIONS.
// `node scripts/bots-table.mjs --write` (after `npm run build`) updates README.md;
// test/readme.test.ts fails when the README is out of date.
import { readFileSync, writeFileSync } from "node:fs";

const KIND = { operator: "operator docs", "source-code": "source", reference: "uap-core" };
const AI = new Set(["ai-crawler", "ai-assistant", "ai-search"]);

/** @param {{ BOT_DEFINITIONS: readonly any[] }} api */
export function botsTable(api) {
  const rows = ["| Name | Category | Operator | robots.txt | Verify | Source |", "| --- | --- | --- | --- | --- | --- |"];
  for (const d of api.BOT_DEFINITIONS) {
    const robots = d.respectsRobotsTxt === true ? "yes" : d.respectsRobotsTxt === false ? "no" : "–";
    const verify = d.verification === undefined ? "–" : `\`${d.verification}\``;
    const sources = d.sources.map((s) => `[${KIND[s.kind]}](${s.url})`).join(", ");
    rows.push(`| ${d.name.replace(/\|/g, "\\|")} | ${d.category} | ${d.operator} | ${robots} | ${verify} | ${sources} |`);
  }
  return rows.join("\n");
}

/** @param {{ BOT_DEFINITIONS: readonly any[] }} api */
export function botStats(api) {
  const defs = api.BOT_DEFINITIONS;
  const ai = defs.filter((d) => AI.has(d.category));
  const byKind = { operator: new Set(), "source-code": new Set(), reference: new Set() };
  for (const d of defs) for (const s of d.sources) byKind[s.kind].add(s.url);
  const total = byKind.operator.size + byKind["source-code"].size + byKind.reference.size;
  const refOnly = defs.filter((d) => d.sources.every((s) => s.kind === "reference")).length;
  const dates = [...new Set(defs.flatMap((d) => d.sources.map((s) => s.retrieved)))].sort();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  return [
    `${defs.length} entries, ${ai.length} of them AI agents from ${new Set(ai.map((d) => d.operator)).size} operators.`,
    `They cite ${total} distinct pages: ${plural(byKind.operator.size, "operator documentation page", "operator documentation pages")},`,
    `${plural(byKind["source-code"].size, "source file or manual", "source files or manuals")} (HTTP libraries and tools)`,
    `and ${plural(byKind.reference.size, "reference corpus", "reference corpora")} (uap-core, used for ${refOnly} agents without an official page),`,
    `retrieved on ${dates.join(", ")}.`,
  ].join("\n");
}

/** Replaces the generated blocks in a README text. */
export function renderReadme(text, api) {
  return text
    .replace(/(<!-- bot-stats:start -->\n)[\s\S]*?(<!-- bot-stats:end -->)/, `$1${botStats(api)}\n$2`)
    .replace(/(<!-- bots:start -->\n)[\s\S]*?(<!-- bots:end -->)/, `$1${botsTable(api)}\n$2`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const api = await import("../dist/index.js");
  const path = new URL("../README.md", import.meta.url);
  const next = renderReadme(readFileSync(path, "utf8"), api);
  if (process.argv.includes("--write")) writeFileSync(path, next);
  else process.stdout.write(botStats(api) + "\n");
}
