import { fail } from "./error.js";

/**
 * Validate and return a contained bundle path.
 */
export function validateBundlePath(filePath: string): string {
  if (
    filePath === "" ||
    filePath.includes("\\") ||
    isAbsolutePath(filePath) ||
    filePath.includes("//") ||
    filePath.startsWith("/") ||
    filePath.endsWith("/")
  ) {
    fail("PATH_INVALID", `Invalid bundle path: ${filePath}`);
  }

  for (const segment of filePath.split("/")) {
    if (segment === "" || segment === "." || segment === "..") {
      fail("PATH_INVALID", `Invalid bundle path: ${filePath}`);
    }
  }

  return filePath;
}

/**
 * Resolve a reference written in one bundle file to a bundle path.
 */
export function resolveBundleReference(fromPath: string, referencePath: string): string {
  if (referencePath === "") {
    fail("PATH_INVALID", "Invalid bundle reference: empty path");
  }

  const from = validateBundlePath(fromPath);
  const target = resolveReferencePath(getBundlePathDirectory(from), referencePath);

  return target === "" ? "" : validateBundlePath(target);
}

/**
 * Format a bundle path as a relative reference from one bundle file.
 */
export function formatBundleReference(fromPath: string, targetPath: string): string {
  const from = validateBundlePath(fromPath);
  const target = validateBundlePath(targetPath);

  const relative = getRelativeBundlePath(getBundlePathDirectory(from), target);

  return relative === "" ? getBundlePathBaseName(target) : relative;
}

/**
 * Compare bundle paths with stable JavaScript string ordering.
 */
export function compareBundlePaths(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isAbsolutePath(filePath: string): boolean {
  return (
    filePath.startsWith("/") || filePath.startsWith("\\\\") || /^[a-zA-Z]:[\\/]/.test(filePath)
  );
}

function getBundlePathDirectory(filePath: string): string {
  const index = filePath.lastIndexOf("/");
  return index === -1 ? "" : filePath.slice(0, index);
}

function getBundlePathBaseName(filePath: string): string {
  const index = filePath.lastIndexOf("/");
  return index === -1 ? filePath : filePath.slice(index + 1);
}

function getRelativeBundlePath(fromDirectory: string, targetPath: string): string {
  const fromParts = fromDirectory === "" ? [] : fromDirectory.split("/");
  const targetParts = targetPath.split("/");

  let shared = 0;
  while (
    shared < fromParts.length &&
    shared < targetParts.length &&
    fromParts[shared] === targetParts[shared]
  ) {
    shared += 1;
  }

  return [
    ...Array<string>(fromParts.length - shared).fill(".."),
    ...targetParts.slice(shared),
  ].join("/");
}

/**
 * Resolve a reference path before validating the resulting bundle path.
 */
function resolveReferencePath(fromDirectory: string, referencePath: string): string {
  if (referencePath.includes("\\")) {
    fail("PATH_INVALID", `Invalid bundle reference: ${referencePath}`);
  }

  const absolute = referencePath.startsWith("/");
  const rawReference = absolute ? referencePath.slice(1) : referencePath;
  const segments = absolute || fromDirectory === "" ? [] : fromDirectory.split("/");

  if (rawReference === "") {
    return "";
  }

  for (const segment of rawReference.split("/")) {
    if (segment === "") {
      fail("PATH_INVALID", `Invalid bundle reference: ${referencePath}`);
    }

    if (segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (segments.length === 0) {
        fail("PATH_INVALID", `Invalid bundle reference: ${referencePath}`);
      }

      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.join("/");
}
