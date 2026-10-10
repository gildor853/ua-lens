import { fail, show } from "./errors.js";

/** Default cap on the length of a User-Agent (and of each hint value). */
export const DEFAULT_MAX_LENGTH = 2048;
const MAX_MAX_LENGTH = 1_000_000;

/** @internal Validates the `maxLength` option. */
export function maxLengthOption(value: unknown): number {
  if (value === undefined) return DEFAULT_MAX_LENGTH;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_MAX_LENGTH) {
    fail("InvalidOption", `maxLength must be an integer between 1 and ${MAX_MAX_LENGTH}, got ${show(value)}`);
  }
  return value;
}

/** @internal Options must be a plain object (or undefined). */
export function optionsObject<T extends object>(value: unknown, fn: string): Partial<T> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) fail("InvalidOption", `${fn}: options must be an object, got ${show(value)}`);
  return value as Partial<T>;
}

/**
 * @internal Accepts a string, `undefined` or `null` (a missing header) and returns
 * the capped string. Anything else throws {@link UaLensError} `InvalidInput`.
 */
export function uaInput(value: unknown, maxLength: number, fn: string): { ua: string; truncated: boolean } {
  if (value === undefined || value === null) return { ua: "", truncated: false };
  if (typeof value !== "string") fail("InvalidInput", `${fn}: the user agent must be a string, got ${show(value)}`);
  if (value.length <= maxLength) return { ua: value, truncated: false };
  return { ua: value.slice(0, maxLength), truncated: true };
}
