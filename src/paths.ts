import path from "node:path";

import { fail } from "./error.js";

/**
 * Normalize a stored bundle file path, which cannot be the bundle root.
 */
export function normalizeBundleFilePath(filePath: string): string {
  const normalized = normalizeBundlePath(filePath);

  if (normalized === "") {
    fail("PATH_INVALID", `Invalid bundle path: ${filePath}`);
  }

  return normalized;
}

/**
 * Resolve a reference written in one bundle file to a bundle path.
 */
export function resolveBundleReference(fromPath: string, referencePath: string): string {
  if (referencePath === "") {
    fail("PATH_INVALID", "Invalid bundle reference: empty path");
  }

  const from = normalizeBundleFilePath(fromPath);

  const reference = referencePath.replaceAll("\\", "/");
  const target = reference.startsWith("/")
    ? reference.slice(1)
    : path.posix.join(path.posix.dirname(from), reference);

  return normalizeBundlePath(target);
}

/**
 * Format a bundle path as a relative reference from one bundle file.
 */
export function formatBundleReference(fromPath: string, targetPath: string): string {
  const from = normalizeBundleFilePath(fromPath);
  const target = normalizeBundleFilePath(targetPath);

  const fromDirectory = path.posix.dirname(from);
  const relative = path.posix.relative(fromDirectory === "." ? "" : fromDirectory, target);

  return relative === "" ? path.posix.basename(target) : relative;
}

/**
 * Compare bundle paths with stable JavaScript string ordering.
 */
export function compareBundlePaths(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Normalize a bundle path that may point to the bundle root.
 */
function normalizeBundlePath(filePath: string): string {
  if (isAbsolutePath(filePath)) {
    fail("PATH_INVALID", `Invalid bundle path: ${filePath}`);
  }

  const segments: string[] = [];

  for (const segment of filePath.replaceAll("\\", "/").split("/")) {
    if (segment === "" || segment === ".") continue;

    if (segment === "..") {
      if (segments.length === 0) {
        fail("PATH_INVALID", `Invalid bundle path: ${filePath}`);
      }

      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.join("/");
}

function isAbsolutePath(filePath: string): boolean {
  return path.posix.isAbsolute(filePath) || path.win32.isAbsolute(filePath);
}
