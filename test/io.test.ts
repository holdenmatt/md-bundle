import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  createBundle,
  getBinaryFile,
  getFile,
  getTextFile,
  loadBundle,
  MarkdownBundleError,
  writeBundle,
} from "../src/index.js";

describe("loadBundle", () => {
  test("loads from a root file and preserves text and binary files", async () => {
    await withTempDir(async (directory) => {
      await writeFile(path.join(directory, "SKILL.md"), "# Skill\n", "utf8");
      await mkdir(path.join(directory, "references"));
      await writeFile(path.join(directory, "references", "checklist.md"), "# Checklist\n");
      await mkdir(path.join(directory, "assets"));
      await writeFile(path.join(directory, "assets", "logo.bin"), new Uint8Array([0xff]));
      await mkdir(path.join(directory, ".git"));
      await writeFile(path.join(directory, ".git", "config"), "ignored");

      const bundle = await loadBundle(path.join(directory, "SKILL.md"));

      expect(bundle.root).toEqual({ path: "SKILL.md", content: "# Skill\n" });
      expect(getTextFile(bundle, "references/checklist.md")).toEqual({
        path: "references/checklist.md",
        content: "# Checklist\n",
      });
      expect(getBinaryFile(bundle, "assets/logo.bin")).toEqual({
        path: "assets/logo.bin",
        bytes: new Uint8Array([0xff]),
      });
      expect(() => getFile(bundle, ".git/config")).toThrow(
        expect.objectContaining({ code: "FILE_MISSING" }),
      );
    });
  });

  test("uses explicit roots for directory input", async () => {
    await withTempDir(async (directory) => {
      await writeFile(path.join(directory, "README.md"), "# Readme\n");
      await writeFile(path.join(directory, "GUIDE.md"), "# Guide\n");

      const bundle = await loadBundle(directory, { rootPath: "GUIDE.md" });

      expect(bundle.root).toEqual({ path: "GUIDE.md", content: "# Guide\n" });
    });
  });

  test.each([
    ["only top-level markdown", ["README.md"], "README.md"],
    ["skill convention", ["README.md", "SKILL.md"], "SKILL.md"],
    ["index convention", ["README.md", "index.md"], "index.md"],
  ])("infers root from %s", async (_name, fileNames, expected) => {
    await withTempDir(async (directory) => {
      for (const fileName of fileNames) {
        await writeFile(path.join(directory, fileName), `# ${fileName}\n`);
      }

      const bundle = await loadBundle(directory);

      expect(bundle.root.path).toBe(expected);
    });
  });

  test.each([
    ["missing root", ["references/checklist.md"], "ROOT_MISSING"],
    ["ambiguous root", ["README.md", "GUIDE.md"], "ROOT_AMBIGUOUS"],
  ])("fails for %s", async (_name, fileNames, code) => {
    await withTempDir(async (directory) => {
      for (const fileName of fileNames) {
        await mkdir(path.dirname(path.join(directory, fileName)), { recursive: true });
        await writeFile(path.join(directory, fileName), "# Doc\n");
      }

      await expect(loadBundle(directory)).rejects.toThrow(MarkdownBundleError);
      await expect(loadBundle(directory)).rejects.toMatchObject({ code });
    });
  });

  test("fails when the input path does not exist", async () => {
    await withTempDir(async (directory) => {
      await expect(loadBundle(path.join(directory, "missing.md"))).rejects.toMatchObject({
        code: "BUNDLE_LOAD_ERROR",
      });
    });
  });

  test("does not follow symlinks", async () => {
    await withTempDir(async (directory) => {
      await writeFile(path.join(directory, "SKILL.md"), "# Skill\n");
      await writeFile(path.join(directory, "target.md"), "# Target\n");
      await symlink(path.join(directory, "target.md"), path.join(directory, "linked.md"));

      const bundle = await loadBundle(directory);

      expect(() => getFile(bundle, "linked.md")).toThrow(
        expect.objectContaining({ code: "FILE_MISSING" }),
      );
    });
  });
});

describe("writeBundle", () => {
  test("writes bundle files and preserves existing output directories", async () => {
    await withTempDir(async (directory) => {
      const output = path.join(directory, "dist");
      await mkdir(path.join(output, "references"), { recursive: true });
      await writeFile(path.join(output, "references", "old.md"), "# Old\n");
      await writeFile(path.join(output, "references", "checklist.md"), "# Old checklist\n");

      const bundle = createBundle({
        rootPath: "SKILL.md",
        files: [
          { path: "SKILL.md", content: "# Skill\n" },
          { path: "references/checklist.md", content: "# Checklist\n" },
          { path: "assets/logo.bin", bytes: new Uint8Array([0xff]) },
        ],
      });

      await expect(writeBundle(bundle, output)).resolves.toBeUndefined();

      await expect(readFile(path.join(output, "SKILL.md"), "utf8")).resolves.toBe("# Skill\n");
      await expect(readFile(path.join(output, "references", "checklist.md"), "utf8")).resolves.toBe(
        "# Checklist\n",
      );
      await expect(readFile(path.join(output, "references", "old.md"), "utf8")).resolves.toBe(
        "# Old\n",
      );
      await expect(readFile(path.join(output, "assets", "logo.bin"))).resolves.toEqual(
        Buffer.from([0xff]),
      );
    });
  });
});

async function withTempDir(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(path.join(tmpdir(), "md-bundle-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}
