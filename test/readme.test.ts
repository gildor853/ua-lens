import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS helper without type declarations
import { renderReadme } from "../scripts/bots-table.mjs";
import * as api from "../src/index.js";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

describe("README", () => {
  it("generated bot statistics and table are up to date (node scripts/bots-table.mjs --write)", () => {
    expect(renderReadme(readme, api)).toBe(readme);
    expect(readme).toContain(`${api.BOT_DEFINITIONS.length} entries`);
  });

  it("lists every excluded agent and every robots.txt-only token", () => {
    for (const t of api.ROBOTS_ONLY_TOKENS) expect(readme).toContain(`\`${t.token}\``);
    for (const t of ["anthropic-ai", "Claude-Web", "FacebookBot", "cohere-ai", "Timpibot", "Bytespider", "TelegramBot"]) expect(readme).toContain(`\`${t}\``);
  });

  it("install snippet references a tag", () => {
    expect(readme).toContain("npm install github:gildor853/ua-lens#v1.0.0");
    expect(readme).not.toMatch(/badge\.fury|img\.shields\.io\/npm/);
  });
});
