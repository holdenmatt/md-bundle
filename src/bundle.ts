import { fail } from "./error.js";
import { compareBundlePaths, validateBundlePath } from "./paths.js";

import type {
  MarkdownBundle,
  MarkdownBundleBinaryFile,
  MarkdownBundleFile,
  MarkdownBundleTextFile,
} from "./types.js";

/**
 * Input accepted by `createBundle`.
 */
export type CreateBundleInput = {
  /** Bundle path of the root text file. */
  rootPath: string;

  /** Files to normalize into the bundle. */
  files: MarkdownBundleFile[];
};

/**
 * Create a normalized in-memory bundle.
 */
export function createBundle(input: CreateBundleInput): MarkdownBundle {
  const rootPath = validateBundlePath(input.rootPath);

  const seen = new Set<string>();
  const files: MarkdownBundleFile[] = [];

  for (const inputFile of input.files) {
    const file = normalizeInputFile(inputFile);

    if (seen.has(file.path)) {
      fail("FILE_DUPLICATE", `Duplicate bundle file: ${file.path}`);
    }

    seen.add(file.path);
    files.push(file);
  }

  const sortedFiles = files.sort((left, right) => compareBundlePaths(left.path, right.path));
  const root = sortedFiles.find(
    (file): file is MarkdownBundleTextFile => isTextFile(file) && file.path === rootPath,
  );

  if (root === undefined) {
    const matchingFile = sortedFiles.find((file) => file.path === rootPath);
    if (matchingFile === undefined) {
      fail("ROOT_MISSING", `Bundle root does not exist: ${rootPath}`);
    }

    fail("ROOT_INVALID", `Bundle root must be a text file: ${rootPath}`);
  }

  return { root, files: sortedFiles };
}

/**
 * Get any bundle file by path.
 */
export function getFile(bundle: MarkdownBundle, bundlePath: string): MarkdownBundleFile {
  const normalized = validateBundlePath(bundlePath);

  const file = bundle.files.find((item) => item.path === normalized);
  return file === undefined
    ? fail("FILE_MISSING", `Bundle file does not exist: ${normalized}`)
    : file;
}

/**
 * Get a text bundle file by path.
 */
export function getTextFile(bundle: MarkdownBundle, bundlePath: string): MarkdownBundleTextFile {
  const file = getFile(bundle, bundlePath);

  return isTextFile(file) ? file : fail("FILE_NOT_TEXT", `Bundle file is not text: ${file.path}`);
}

/**
 * Get a binary bundle file by path.
 */
export function getBinaryFile(
  bundle: MarkdownBundle,
  bundlePath: string,
): MarkdownBundleBinaryFile {
  const file = getFile(bundle, bundlePath);

  return isBinaryFile(file)
    ? file
    : fail("FILE_NOT_BINARY", `Bundle file is not binary: ${file.path}`);
}

type BundleFileCandidate = {
  path: string;
  content?: unknown;
  bytes?: unknown;
};

/**
 * Normalize one caller-provided file into the stored bundle shape.
 */
function normalizeInputFile(file: BundleFileCandidate): MarkdownBundleFile {
  const normalized = validateBundlePath(file.path);

  if (isTextFile(file)) {
    return { path: normalized, content: file.content };
  }

  if (isBinaryFile(file)) {
    return { path: normalized, bytes: file.bytes };
  }

  fail("FILE_INVALID", `Invalid bundle file: ${file.path}`);
}

function isTextFile(file: BundleFileCandidate): file is MarkdownBundleTextFile {
  return "content" in file && typeof file.content === "string" && !("bytes" in file);
}

function isBinaryFile(file: BundleFileCandidate): file is MarkdownBundleBinaryFile {
  return "bytes" in file && file.bytes instanceof Uint8Array && !("content" in file);
}
