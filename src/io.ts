import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createBundle } from "./bundle.js";
import { fail } from "./error.js";
import { compareBundlePaths, normalizeBundleFilePath } from "./paths.js";

import type { MarkdownBundle, MarkdownBundleFile, MarkdownBundleTextFile } from "./types.js";

export type LoadBundleOptions = {
  /** Bundle path of the root Markdown file. */
  rootPath?: string;
};

const textDecoder = new TextDecoder("utf-8", { fatal: true });

/**
 * Load a bundle from a root file or bundle directory.
 */
export async function loadBundle(
  inputPath: string,
  options: LoadBundleOptions = {},
): Promise<MarkdownBundle> {
  let inputStats;
  try {
    inputStats = await lstat(inputPath);
  } catch {
    fail("BUNDLE_LOAD_ERROR", `Could not read bundle path: ${inputPath}`);
  }

  if (inputStats.isSymbolicLink()) {
    fail("BUNDLE_LOAD_ERROR", `Bundle path cannot be a symlink: ${inputPath}`);
  }

  if (!inputStats.isDirectory() && !inputStats.isFile()) {
    fail("BUNDLE_LOAD_ERROR", `Bundle path is not a file or directory: ${inputPath}`);
  }

  const bundleDirectory = inputStats.isDirectory() ? inputPath : path.dirname(inputPath);
  const defaultRootPath = inputStats.isFile()
    ? path.basename(inputPath).replaceAll("\\", "/")
    : undefined;

  const files = await loadBundleFiles(bundleDirectory);

  const rootPath = options.rootPath ?? defaultRootPath;
  if (rootPath !== undefined) {
    return createBundle({ rootPath, files });
  }

  const inferredRootPath = inferRootPath(files);
  return createBundle({ rootPath: inferredRootPath, files });
}

/**
 * Write bundle files into a directory.
 */
export async function writeBundle(bundle: MarkdownBundle, directory: string): Promise<void> {
  for (const file of bundle.files) {
    const bundlePath = normalizeBundleFilePath(file.path);
    const outputPath = path.join(directory, ...bundlePath.split("/"));

    try {
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, isTextFile(file) ? file.content : file.bytes);
    } catch {
      fail("BUNDLE_WRITE_ERROR", `Could not write bundle file: ${bundlePath}`);
    }
  }
}

/**
 * Load every regular file below a bundle directory.
 */
async function loadBundleFiles(directory: string): Promise<MarkdownBundleFile[]> {
  const files: MarkdownBundleFile[] = [];

  async function visit(currentDirectory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(currentDirectory, { withFileTypes: true });
    } catch {
      fail("BUNDLE_LOAD_ERROR", `Could not read directory: ${currentDirectory}`);
    }

    for (const entry of entries.sort((left, right) => compareBundlePaths(left.name, right.name))) {
      if ((entry.name === ".git" && entry.isDirectory()) || entry.isSymbolicLink()) continue;

      const absolutePath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (!entry.isFile()) continue;

      let bytes;
      try {
        bytes = await readFile(absolutePath);
      } catch {
        fail("BUNDLE_LOAD_ERROR", `Could not read file: ${absolutePath}`);
      }

      const bundlePath = path.relative(directory, absolutePath).replaceAll("\\", "/");
      const text = decodeUtf8(bytes);
      files.push(
        text !== undefined
          ? { path: bundlePath, content: text }
          : { path: bundlePath, bytes: new Uint8Array(bytes) },
      );
    }
  }

  await visit(directory);
  return files;
}

/**
 * Infer a conventional root from top-level Markdown files.
 */
function inferRootPath(files: MarkdownBundleFile[]): string {
  const topLevelMarkdown = files
    .map((file) => normalizeBundleFilePath(file.path))
    .filter((filePath) => !filePath.includes("/") && filePath.endsWith(".md"));

  if (topLevelMarkdown.length === 1) {
    return topLevelMarkdown[0]!;
  }

  if (topLevelMarkdown.includes("SKILL.md")) {
    return "SKILL.md";
  }

  if (topLevelMarkdown.includes("index.md")) {
    return "index.md";
  }

  fail(
    topLevelMarkdown.length === 0 ? "ROOT_MISSING" : "ROOT_AMBIGUOUS",
    "Could not infer bundle root. Pass an explicit rootPath.",
  );
}

/**
 * Decode bytes only when they are valid UTF-8.
 */
function decodeUtf8(bytes: Uint8Array): string | undefined {
  try {
    return textDecoder.decode(bytes);
  } catch {
    return undefined;
  }
}

function isTextFile(file: MarkdownBundleFile): file is MarkdownBundleTextFile {
  return "content" in file;
}
