import { describe, expect, test } from "vitest";

import {
  formatBundleReference,
  MarkdownBundleError,
  resolveBundleReference,
} from "../src/index.js";

describe("resolveBundleReference", () => {
  test.each([
    ["docs/index.md", "./intro.md", "docs/intro.md"],
    ["docs/index.md", "../README.md", "README.md"],
    ["docs/index.md", "/assets/logo.png", "assets/logo.png"],
    ["docs/index.md", "/", ""],
    ["README.md", ".", ""],
    ["README.md", "docs/intro.md", "docs/intro.md"],
  ])("resolves %s + %s", (fromPath, referencePath, expected) => {
    expect(resolveBundleReference(fromPath, referencePath)).toBe(expected);
  });

  test.each([
    ["docs/index.md", ""],
    ["docs/index.md", "../../outside.md"],
  ])("rejects invalid reference %s + %s", (fromPath, referencePath) => {
    expect(() => resolveBundleReference(fromPath, referencePath)).toThrow(MarkdownBundleError);
    expect(() => resolveBundleReference(fromPath, referencePath)).toThrow(
      expect.objectContaining({ code: "PATH_INVALID" }),
    );
  });
});

describe("formatBundleReference", () => {
  test.each([
    ["docs/index.md", "assets/logo.png", "../assets/logo.png"],
    ["docs/index.md", "docs/intro.md", "intro.md"],
    ["README.md", "docs/intro.md", "docs/intro.md"],
  ])("formats %s -> %s", (fromPath, targetPath, expected) => {
    expect(formatBundleReference(fromPath, targetPath)).toBe(expected);
  });

  test("rejects invalid target paths", () => {
    expect(() => formatBundleReference("docs/index.md", "../outside.md")).toThrow(
      expect.objectContaining({ code: "PATH_INVALID" }),
    );
  });
});
