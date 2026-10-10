// Conformance against the HTTP WG structured-field-tests suite (RFC 9651).
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSfDictionary, parseSfItem, parseSfList, type SfBareItem, type SfItem, type SfMember, type SfParams } from "../src/sfv.js";

interface Case {
  name: string;
  raw?: string[];
  header_type: "item" | "list" | "dictionary";
  expected?: unknown;
  must_fail?: boolean;
  can_fail?: boolean;
}

const dir = new URL("./fixtures/structured-field-tests/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

const base32 = (b: Uint8Array) => {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of b) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += a[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += a[(value << (5 - bits)) & 31];
  while (out.length % 8) out += "=";
  return out;
};

function bare(v: SfBareItem): unknown {
  if (typeof v === "object") {
    if (v.type === "decimal") return v.value;
    if (v.type === "binary") return { __type: "binary", value: base32(v.value) };
    return { __type: v.type, value: v.value };
  }
  return v;
}
const params = (p: SfParams) => p.map(([k, v]) => [k, bare(v)]);
const item = (i: SfItem) => [bare(i.value), params(i.params)];
const member = (m: SfMember) => (Array.isArray(m.value) ? [(m.value as SfItem[]).map(item), params(m.params)] : item(m as SfItem));

describe.each(files)("%s", (file) => {
  const cases = (JSON.parse(readFileSync(new URL(file, dir), "utf8")) as Case[]).filter((c) => c.raw !== undefined);
  it.each(cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const raw = (c.raw as string[]).join(", ");
    let got: unknown;
    if (c.header_type === "item") {
      const r = parseSfItem(raw);
      got = r && item(r);
    } else if (c.header_type === "list") {
      const r = parseSfList(raw);
      got = r && r.map(member);
    } else {
      const r = parseSfDictionary(raw);
      got = r && r.map(([k, m]) => [k, member(m)]);
    }
    if (c.must_fail) expect(got).toBeUndefined();
    else if (c.can_fail && got === undefined) return;
    else expect(got).toEqual(c.expected);
  });
});
