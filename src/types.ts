/**
 * Folder-shaped collection of files with one root Markdown file.
 */
export type MarkdownBundle = {
  /** Text file clients should read first. */
  root: MarkdownBundleTextFile;

  /** Complete bundle file list, including `root`. */
  files: MarkdownBundleFile[];
};

/**
 * File stored in a Markdown bundle.
 */
export type MarkdownBundleFile = MarkdownBundleTextFile | MarkdownBundleBinaryFile;

/**
 * Text file stored in a Markdown bundle.
 */
export type MarkdownBundleTextFile = {
  /** Bundle-relative file path. */
  path: string;

  /** Text content. */
  content: string;
};

/**
 * Binary file stored in a Markdown bundle.
 */
export type MarkdownBundleBinaryFile = {
  /** Bundle-relative file path. */
  path: string;

  /** Raw file bytes. */
  bytes: Uint8Array;
};

/**
 * Check whether a bundle file stores text content.
 */
export function isTextFile(file: MarkdownBundleFile): file is MarkdownBundleTextFile {
  return "content" in file;
}

/**
 * Check whether a bundle file stores binary bytes.
 */
export function isBinaryFile(file: MarkdownBundleFile): file is MarkdownBundleBinaryFile {
  return "bytes" in file;
}

/**
 * Check whether a bundle file is a Markdown text file.
 */
export function isMarkdownFile(file: MarkdownBundleFile): file is MarkdownBundleTextFile {
  return isTextFile(file) && file.path.endsWith(".md");
}
