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
    : joinBundlePaths(getBundlePathDirectory(from), reference);

  return normalizeBundlePath(target);
}

/**
 * Format a bundle path as a relative reference from one bundle file.
 */
export function formatBundleReference(fromPath: string, targetPath: string): string {
  const from = normalizeBundleFilePath(fromPath);
  const target = normalizeBundleFilePath(targetPath);

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
  return (
    filePath.startsWith("/") || filePath.startsWith("\\\\") || /^[a-zA-Z]:[\\/]/.test(filePath)
  );
}

function joinBundlePaths(directory: string, filePath: string): string {
  return directory === "" ? filePath : `${directory}/${filePath}`;
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
