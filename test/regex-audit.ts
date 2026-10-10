/**
 * A deliberately strict static check for regular expressions that could backtrack
 * super-linearly. It is a heuristic, not a proof: anything it flags must be
 * rewritten; anything it passes is additionally exercised by the fuzz timing test.
 */
export interface RegexIssue {
  source: string;
  problem: string;
}

interface Frame {
  hasQuantifier: boolean;
  hasAlternation: boolean;
}

/** Parses a quantifier at position i; returns [min, max (Infinity = unbounded), length] or undefined. */
function quantifierAt(src: string, i: number): [number, number, number] | undefined {
  const c = src[i];
  if (c === "*") return [0, Infinity, 1];
  if (c === "+") return [1, Infinity, 1];
  if (c === "?") return [0, 1, 1];
  if (c === "{") {
    const m = /^\{(\d+)(,(\d*))?\}/.exec(src.slice(i));
    if (m === null) return undefined;
    const min = Number(m[1]);
    const max = m[2] === undefined ? min : m[3] === "" ? Infinity : Number(m[3]);
    return [min, max, m[0].length];
  }
  return undefined;
}

/** Outer repetition allowed around a group that itself repeats or alternates. */
const MAX_NESTED_OUTER = 4;
/** Largest bounded repetition we accept (keeps worst-case backtracking small). */
const MAX_BOUND = 2048;

export function auditRegex(re: RegExp): RegexIssue[] {
  const src = re.source;
  const issues: RegexIssue[] = [];
  const stack: Frame[] = [{ hasQuantifier: false, hasAlternation: false }];
  let i = 0;
  let lastGroup: Frame | undefined;
  while (i < src.length) {
    const c = src[i]!;
    let atom: Frame | undefined;
    if (c === "\\") {
      i += 2;
      atom = { hasQuantifier: false, hasAlternation: false };
    } else if (c === "[") {
      i++;
      if (src[i] === "^") i++;
      if (src[i] === "]") i++;
      while (i < src.length && src[i] !== "]") i += src[i] === "\\" ? 2 : 1;
      i++;
      atom = { hasQuantifier: false, hasAlternation: false };
    } else if (c === "(") {
      stack.push({ hasQuantifier: false, hasAlternation: false });
      i++;
      if (src[i] === "?") {
        // (?: (?= (?! (?<= (?<! (?<name>
        i++;
        if (src[i] === "<" && src[i + 1] !== "=" && src[i + 1] !== "!") {
          while (src[i] !== ">") i++;
        }
        i++;
      }
      continue;
    } else if (c === ")") {
      const frame = stack.pop()!;
      i++;
      atom = frame;
    } else if (c === "|") {
      stack[stack.length - 1]!.hasAlternation = true;
      i++;
      continue;
    } else if (c === "." ) {
      i++;
      atom = { hasQuantifier: false, hasAlternation: false };
      const q = quantifierAt(src, i);
      if (q !== undefined && q[1] === Infinity) issues.push({ source: src, problem: `unbounded .${src[i]}` });
    } else {
      i++;
      atom = { hasQuantifier: false, hasAlternation: false };
    }
    lastGroup = atom;
    const q = quantifierAt(src, i);
    if (q !== undefined) {
      const [, max, len] = q;
      i += len;
      if (src[i] === "?") i++; // lazy
      if (max === Infinity) issues.push({ source: src, problem: `unbounded quantifier at ${i - len}` });
      else if (max > MAX_BOUND) issues.push({ source: src, problem: `bound ${max} exceeds ${MAX_BOUND}` });
      if (max > MAX_NESTED_OUTER && (lastGroup.hasQuantifier || lastGroup.hasAlternation)) {
        issues.push({ source: src, problem: `repeated group containing ${lastGroup.hasQuantifier ? "a quantifier" : "alternation"} (outer max ${max})` });
      }
      if (max > 1) stack[stack.length - 1]!.hasQuantifier = true;
    }
    if (atom.hasQuantifier) stack[stack.length - 1]!.hasQuantifier = true;
  }
  return issues;
}

/** Collects every RegExp reachable from the given values (objects, arrays, maps). */
export function collectRegexes(values: unknown[]): RegExp[] {
  const out = new Set<RegExp>();
  const seen = new Set<unknown>();
  const visit = (v: unknown): void => {
    if (v instanceof RegExp) {
      out.add(v);
      return;
    }
    if (v === null || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (v instanceof Map) for (const x of v.values()) visit(x);
    else for (const x of Object.values(v)) visit(x);
  };
  values.forEach(visit);
  return [...out];
}
