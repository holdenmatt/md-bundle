/**
 * Error thrown by expected md-bundle failures.
 */
export class MarkdownBundleError<TCode extends string = string> extends Error {
  /** Machine-readable error code. */
  readonly code: TCode;

  constructor(code: TCode, message: string) {
    super(message);
    this.name = "MarkdownBundleError";
    this.code = code;
  }
}

/**
 * Throw an expected md-bundle failure with a stable error code.
 */
export function fail<TCode extends string>(code: TCode, message: string): never {
  throw new MarkdownBundleError(code, message);
}
