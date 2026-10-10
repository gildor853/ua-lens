/** Error codes thrown by ua-lens. */
export type UaLensErrorCode = "InvalidInput" | "InvalidOption";

/** The only error type thrown by ua-lens functions (parsing never throws on string input). */
export class UaLensError extends Error {
  readonly code: UaLensErrorCode;
  constructor(code: UaLensErrorCode, message: string) {
    super(message);
    this.name = "UaLensError";
    this.code = code;
  }
}

/** True when `value` is a {@link UaLensError}. */
export function isUaLensError(value: unknown): value is UaLensError {
  return value instanceof UaLensError;
}

/** @internal */
export function fail(code: UaLensErrorCode, message: string): never {
  throw new UaLensError(code, message);
}

/** @internal Short, safe description of a value for error messages. */
export function show(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value);
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "object") return "an object";
  if (typeof value === "bigint") return `${value}n`;
  return String(value);
}
