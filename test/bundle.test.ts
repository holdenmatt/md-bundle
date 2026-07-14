import { describe, expect, test } from "vitest";

import {
  createBundle,
  getBinaryFile,
  getFile,
  getTextFile,
  isBinaryFile,
  isMarkdownFile,
  isTextFile,
  MarkdownBundleError,
  validateBundlePath,
  type MarkdownBundle,
} from "../src/index.js";

describe("createBundle", () => {
  test("creates a sorted bundle with a root text file", () => {
    const image = new Uint8Array([0, 255]);

    const bundle = createBundle({
      rootPath: "SKILL.md",
      files: [
        { path: "references/checklist.md", content: "# Checklist\n" },
        { path: "assets/logo.png", bytes: image },
        { path: "SKILL.md", content: "# Skill\n" },
      ],
    });

    expect(bundle.root).toBe(bundle.files[0]);
    expect(bundle.root).toEqual({ path: "SKILL.md", content: "# Skill\n" });
    expect(bundle.files).toEqual([
      { path: "SKILL.md", content: "# Skill\n" },
      { path: "assets/logo.png", bytes: image },
      { path: "references/checklist.md", content: "# Checklist\n" },
    ]);
  });

  test("allows explicit text roots that are not Markdown files", () => {
    const bundle = createBundle({
      rootPath: "PROVIDER.yaml",
      files: [
        { path: "PROVIDER.yaml", content: "name: example\n" },
        { path: "docs/README.md", content: "# Example\n" },
      ],
    });

    expect(bundle.root).toEqual({ path: "PROVIDER.yaml", content: "name: example\n" });
  });

  test.each([
    ["missing root", { rootPath: "SKILL.md", files: [] }, "ROOT_MISSING"],
    [
      "escaping root path",
      { rootPath: "../SKILL.md", files: [{ path: "SKILL.md", content: "" }] },
      "PATH_INVALID",
    ],
    [
      "binary root",
      { rootPath: "SKILL.md", files: [{ path: "SKILL.md", bytes: new Uint8Array() }] },
      "ROOT_INVALID",
    ],
    [
      "duplicate path",
      {
        rootPath: "SKILL.md",
        files: [
          { path: "SKILL.md", content: "" },
          { path: "SKILL.md", content: "" },
        ],
      },
      "FILE_DUPLICATE",
    ],
    [
      "escaping path",
      {
        rootPath: "SKILL.md",
        files: [
          { path: "SKILL.md", content: "" },
          { path: "../outside.md", content: "" },
        ],
      },
      "PATH_INVALID",
    ],
    [
      "dot segment path",
      {
        rootPath: "SKILL.md",
        files: [
          { path: "SKILL.md", content: "" },
          { path: "assets/./logo.png", bytes: new Uint8Array() },
        ],
      },
      "PATH_INVALID",
    ],
    [
      "backslash path",
      {
        rootPath: "SKILL.md",
        files: [
          { path: "SKILL.md", content: "" },
          { path: "references\\checklist.md", content: "" },
        ],
      },
      "PATH_INVALID",
    ],
    [
      "absolute path",
      {
        rootPath: "SKILL.md",
        files: [
          { path: "SKILL.md", content: "" },
          { path: "/outside.md", content: "" },
        ],
      },
      "PATH_INVALID",
    ],
    [
      "windows absolute path",
      {
        rootPath: "SKILL.md",
        files: [
          { path: "SKILL.md", content: "" },
          { path: "C:/outside.md", content: "" },
        ],
      },
      "PATH_INVALID",
    ],
    [
      "empty path",
      {
        rootPath: "SKILL.md",
        files: [
          { path: "SKILL.md", content: "" },
          { path: ".", content: "" },
        ],
      },
      "PATH_INVALID",
    ],
  ])("rejects %s", (_name, input, code) => {
    expect(() => createBundle(input)).toThrow(MarkdownBundleError);
    expect(() => createBundle(input)).toThrow(expect.objectContaining({ code }));
  });
});

describe("validateBundlePath", () => {
  test("returns valid contained bundle paths", () => {
    expect(validateBundlePath("references/checklist.md")).toBe("references/checklist.md");
  });

  test.each([
    "",
    ".",
    "docs/../README.md",
    "docs/./README.md",
    "docs//README.md",
    "/README.md",
    "C:/README.md",
    "docs\\README.md",
  ])("rejects invalid bundle path %s", (bundlePath) => {
    expect(() => validateBundlePath(bundlePath)).toThrow(
      expect.objectContaining({ code: "PATH_INVALID" }),
    );
  });
});

describe("get files", () => {
  const bundle = createBundle({
    rootPath: "SKILL.md",
    files: [
      { path: "SKILL.md", content: "# Skill\n" },
      { path: "assets/logo.png", bytes: new Uint8Array([1, 2, 3]) },
    ],
  });

  test("gets files by path", () => {
    expect(getFile(bundle, "SKILL.md")).toEqual({
      path: "SKILL.md",
      content: "# Skill\n",
    });
    expect(getTextFile(bundle, "SKILL.md")).toEqual({
      path: "SKILL.md",
      content: "# Skill\n",
    });
    expect(getBinaryFile(bundle, "assets/logo.png")).toEqual({
      path: "assets/logo.png",
      bytes: new Uint8Array([1, 2, 3]),
    });
  });

  test("fails for missing files and type mismatches", () => {
    expect(() => getFile(bundle, "missing.md")).toThrow(
      expect.objectContaining({ code: "FILE_MISSING" }),
    );
    expect(() => getTextFile(bundle, "assets/logo.png")).toThrow(
      expect.objectContaining({ code: "FILE_NOT_TEXT" }),
    );
    expect(() => getBinaryFile(bundle, "SKILL.md")).toThrow(
      expect.objectContaining({ code: "FILE_NOT_BINARY" }),
    );
  });
});

describe("file guards", () => {
  test("narrows bundle files by content type and markdown path", () => {
    const text = { path: "SKILL.md", content: "# Skill\n" };
    const binary = { path: "assets/logo.png", bytes: new Uint8Array([1]) };

    expect(isTextFile(text)).toBe(true);
    expect(isTextFile(binary)).toBe(false);
    expect(isBinaryFile(binary)).toBe(true);
    expect(isBinaryFile(text)).toBe(false);
    expect(isMarkdownFile(text)).toBe(true);
    expect(isMarkdownFile({ path: "notes.txt", content: "Notes" })).toBe(false);
  });
});

describe("errors and types", () => {
  test("exports structured errors", () => {
    const error = new MarkdownBundleError("EXAMPLE", "Example error");

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("EXAMPLE");
    expect(error.message).toBe("Example error");
  });

  test("exports bundle types", () => {
    const bundle: MarkdownBundle = {
      root: { path: "SKILL.md", content: "" },
      files: [{ path: "SKILL.md", content: "" }],
    };

    expect(bundle.root.path).toBe("SKILL.md");
  });
});
