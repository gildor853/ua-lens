// Structured Field Values for HTTP — RFC 9651 (which obsoletes RFC 8941 and
// adds Dates and Display Strings). Parsing only, following the algorithms in
// RFC 9651 §4.2 exactly; any failure rejects the whole field, as required.

/** A token bare item (`?1`-style booleans and strings have their own JS types). */
export interface SfToken {
  readonly type: "token";
  readonly value: string;
}
/** A byte sequence bare item. */
export interface SfBinary {
  readonly type: "binary";
  readonly value: Uint8Array;
}
/** A date bare item (seconds since the Unix epoch). */
export interface SfDate {
  readonly type: "date";
  readonly value: number;
}
/** A display string bare item (Unicode text). */
export interface SfDisplayString {
  readonly type: "displaystring";
  readonly value: string;
}
/** Decimal numbers are kept apart from integers so the two stay distinguishable. */
export interface SfDecimal {
  readonly type: "decimal";
  readonly value: number;
}

/** A bare item: integer (`number`), decimal, string, token, byte sequence, boolean, date or display string. */
export type SfBareItem = number | string | boolean | SfDecimal | SfToken | SfBinary | SfDate | SfDisplayString;
/** Parameters, in order. Duplicate keys keep the last value, as the RFC requires. */
export type SfParams = ReadonlyArray<readonly [key: string, value: SfBareItem]>;
/** An item with its parameters. */
export interface SfItem {
  readonly value: SfBareItem;
  readonly params: SfParams;
}
/** An inner list with its parameters. */
export interface SfInnerList {
  readonly value: readonly SfItem[];
  readonly params: SfParams;
}
/** A list member. */
export type SfMember = SfItem | SfInnerList;
/** A dictionary, in order; duplicate keys keep the last value. */
export type SfDictionary = ReadonlyArray<readonly [key: string, value: SfMember]>;

class SfError extends Error {}

const DIGIT = /[0-9]/;
const LCALPHA = /[a-z]/;
const ALPHA = /[A-Za-z]/;
const TCHAR = /[!#$%&'*+\-.^_`|~0-9A-Za-z]/;
const KEY_CHAR = /[a-z0-9_\-.*]/;
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** `^[A-Za-z0-9+/]*={0,2}$` written as a loop (keeps every regex in the package bounded). */
function isBase64(s: string): boolean {
  let end = s.length;
  if (s.endsWith("==")) end -= 2;
  else if (s.endsWith("=")) end -= 1;
  for (let i = 0; i < end; i++) if (!BASE64_ALPHABET.includes(s[i]!)) return false;
  return true;
}

class Parser {
  private i = 0;
  constructor(private readonly s: string) {}

  private peek(): string | undefined {
    return this.s[this.i];
  }
  private sp(): void {
    while (this.s[this.i] === " ") this.i++;
  }
  private ows(): void {
    while (this.s[this.i] === " " || this.s[this.i] === "\t") this.i++;
  }
  private fail(): never {
    throw new SfError();
  }
  end(): void {
    this.sp();
    if (this.i !== this.s.length) this.fail();
  }
  start(): void {
    this.sp();
  }

  list(): SfMember[] {
    const out: SfMember[] = [];
    while (this.i < this.s.length) {
      out.push(this.member());
      this.ows();
      if (this.i >= this.s.length) return out;
      if (this.s[this.i] !== ",") this.fail();
      this.i++;
      this.ows();
      if (this.i >= this.s.length) this.fail(); // trailing comma
    }
    return out;
  }

  dictionary(): SfDictionary {
    const map = new Map<string, SfMember>();
    while (this.i < this.s.length) {
      const key = this.key();
      let member: SfMember;
      if (this.s[this.i] === "=") {
        this.i++;
        member = this.member();
      } else {
        member = { value: true, params: this.params() };
      }
      map.set(key, member);
      this.ows();
      if (this.i >= this.s.length) break;
      if (this.s[this.i] !== ",") this.fail();
      this.i++;
      this.ows();
      if (this.i >= this.s.length) this.fail();
    }
    return [...map];
  }

  private member(): SfMember {
    if (this.s[this.i] === "(") return this.innerList();
    return this.item();
  }

  private innerList(): SfInnerList {
    this.i++; // "("
    const items: SfItem[] = [];
    while (this.i < this.s.length) {
      this.sp();
      if (this.s[this.i] === ")") {
        this.i++;
        return { value: items, params: this.params() };
      }
      items.push(this.item());
      const c = this.s[this.i];
      if (c !== " " && c !== ")") this.fail();
    }
    return this.fail();
  }

  item(): SfItem {
    const value = this.bareItem();
    return { value, params: this.params() };
  }

  private bareItem(): SfBareItem {
    const c = this.peek();
    if (c === undefined) return this.fail();
    if (c === "-" || DIGIT.test(c)) return this.number();
    if (c === '"') return this.string();
    if (c === "*" || ALPHA.test(c)) return this.token();
    if (c === ":") return this.binary();
    if (c === "?") return this.boolean();
    if (c === "@") return this.date();
    if (c === "%") return this.displayString();
    return this.fail();
  }

  private params(): SfParams {
    const map = new Map<string, SfBareItem>();
    while (this.s[this.i] === ";") {
      this.i++;
      this.sp();
      const key = this.key();
      let value: SfBareItem = true;
      if (this.s[this.i] === "=") {
        this.i++;
        value = this.bareItem();
      }
      map.set(key, value);
    }
    return [...map];
  }

  private key(): string {
    const c = this.peek();
    if (c === undefined || !(c === "*" || LCALPHA.test(c))) this.fail();
    const start = this.i;
    while (this.i < this.s.length && KEY_CHAR.test(this.s[this.i] as string)) this.i++;
    return this.s.slice(start, this.i);
  }

  private number(): number | SfDecimal {
    let sign = 1;
    if (this.s[this.i] === "-") {
      sign = -1;
      this.i++;
    }
    const c = this.peek();
    if (c === undefined || !DIGIT.test(c)) this.fail();
    const start = this.i;
    let decimal = false;
    while (this.i < this.s.length) {
      const ch = this.s[this.i] as string;
      if (DIGIT.test(ch)) this.i++;
      else if (!decimal && ch === ".") {
        if (this.i - start > 12) this.fail();
        decimal = true;
        this.i++;
      } else break;
      if (!decimal && this.i - start > 15) this.fail();
      if (decimal && this.i - start > 16) this.fail();
    }
    const text = this.s.slice(start, this.i);
    if (!decimal) return sign * Number(text) + 0; // + 0 turns -0 into 0
    if (text.endsWith(".")) this.fail();
    if (text.length - text.indexOf(".") - 1 > 3) this.fail();
    return { type: "decimal", value: sign * Number(text) + 0 };
  }

  private string(): string {
    this.i++; // opening quote
    let out = "";
    while (this.i < this.s.length) {
      const ch = this.s[this.i++] as string;
      if (ch === "\\") {
        const next = this.s[this.i++];
        if (next !== '"' && next !== "\\") this.fail();
        out += next;
      } else if (ch === '"') {
        return out;
      } else {
        const code = ch.charCodeAt(0);
        if (code < 0x20 || code > 0x7e) this.fail();
        out += ch;
      }
    }
    return this.fail();
  }

  private token(): SfToken {
    const start = this.i++;
    while (this.i < this.s.length) {
      const ch = this.s[this.i] as string;
      if (!(TCHAR.test(ch) || ch === ":" || ch === "/")) break;
      this.i++;
    }
    return { type: "token", value: this.s.slice(start, this.i) };
  }

  private binary(): SfBinary {
    this.i++;
    const end = this.s.indexOf(":", this.i);
    if (end < 0) this.fail();
    const b64 = this.s.slice(this.i, end);
    this.i = end + 1;
    if (!isBase64(b64)) this.fail();
    return { type: "binary", value: decodeBase64(b64) };
  }

  private boolean(): boolean {
    this.i++;
    const c = this.s[this.i++];
    if (c === "1") return true;
    if (c === "0") return false;
    return this.fail();
  }

  private date(): SfDate {
    this.i++;
    const n = this.number();
    if (typeof n !== "number") this.fail();
    return { type: "date", value: n };
  }

  private displayString(): SfDisplayString {
    this.i++; // "%"
    if (this.s[this.i] !== '"') this.fail();
    this.i++;
    const bytes: number[] = [];
    while (this.i < this.s.length) {
      const ch = this.s[this.i++] as string;
      const code = ch.charCodeAt(0);
      if (code < 0x20 || code > 0x7e) this.fail();
      if (ch === "%") {
        const hex = this.s.slice(this.i, this.i + 2);
        if (!/^[0-9a-f]{2}$/.test(hex)) this.fail();
        bytes.push(parseInt(hex, 16));
        this.i += 2;
      } else if (ch === '"') {
        const text = utf8Strict(bytes);
        return text === undefined ? this.fail() : { type: "displaystring", value: text };
      } else {
        bytes.push(code);
      }
    }
    return this.fail();
  }
}

function decodeBase64(s: string): Uint8Array {
  const alphabet = BASE64_ALPHABET;
  const clean = s.replace(/={1,2}$/, "");
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    buffer = (buffer << 6) | alphabet.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

/** Strict UTF-8 decoding (no TextDecoder: the core stays free of web/Node globals). */
function utf8Strict(bytes: readonly number[]): string | undefined {
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const b0 = bytes[i] as number;
    let cp: number;
    let n: number;
    if (b0 < 0x80) {
      cp = b0;
      n = 1;
    } else if (b0 >= 0xc2 && b0 <= 0xdf) {
      cp = b0 & 0x1f;
      n = 2;
    } else if (b0 >= 0xe0 && b0 <= 0xef) {
      cp = b0 & 0x0f;
      n = 3;
    } else if (b0 >= 0xf0 && b0 <= 0xf4) {
      cp = b0 & 0x07;
      n = 4;
    } else return undefined;
    if (i + n > bytes.length) return undefined;
    for (let k = 1; k < n; k++) {
      const b = bytes[i + k] as number;
      if ((b & 0xc0) !== 0x80) return undefined;
      cp = (cp << 6) | (b & 0x3f);
    }
    if ((n === 3 && (cp < 0x800 || (cp >= 0xd800 && cp <= 0xdfff))) || (n === 4 && (cp < 0x10000 || cp > 0x10ffff))) return undefined;
    out += String.fromCodePoint(cp);
    i += n;
  }
  return out;
}

function run<T>(input: string, f: (p: Parser) => T): T | undefined {
  if (typeof input !== "string") return undefined;
  const p = new Parser(input);
  try {
    p.start();
    const value = f(p);
    p.end();
    return value;
  } catch (err) {
    if (err instanceof SfError) return undefined;
    /* c8 ignore next */
    throw err;
  }
}

/** Parses a Structured Field List; `undefined` when the field is invalid. */
export function parseSfList(input: string): SfMember[] | undefined {
  return run(input, (p) => p.list());
}

/** Parses a Structured Field Dictionary; `undefined` when the field is invalid. */
export function parseSfDictionary(input: string): SfDictionary | undefined {
  return run(input, (p) => p.dictionary());
}

/** Parses a Structured Field Item; `undefined` when the field is invalid. */
export function parseSfItem(input: string): SfItem | undefined {
  return run(input, (p) => p.item());
}
