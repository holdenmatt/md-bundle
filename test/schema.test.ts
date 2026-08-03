import { markdownSchema } from "@holdenmatt/md-schema";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createBundle } from "../src/index.js";
import { bundleSchema } from "../src/schema.js";

const rootFile = {
  path: "ROOT.md",
  content: "---\nname: demo\n---\n\nHello.\n",
};

function bundleOf(
  files: Array<{ path: string; content: string } | { path: string; bytes: Uint8Array }>,
) {
  return createBundle({ rootPath: rootFile.path, files: [rootFile, ...files] });
}

describe("bundleSchema", () => {
  it("accepts md-schema directly and returns typed root data", () => {
    const schema = bundleSchema({
      root: {
        path: "ROOT.md",
        parser: markdownSchema(z.object({ name: z.string() })),
      },
      additionalFiles: { text: "allow", binary: "block" },
    });

    const result = schema.parse(bundleOf([]));

    if (!result.success) throw new Error("Expected the bundle to parse.");
    expect(result.root.frontmatter.name).toBe("demo");
    expect(result.root.body).toBe("Hello.");
  });

  it("supports typed non-Markdown roots through the same safe-parser contract", () => {
    const schema = bundleSchema({
      root: {
        path: "MANIFEST.json",
        parser: {
          parse(input: string) {
            try {
              return { success: true as const, data: JSON.parse(input) as { name: string } };
            } catch (error) {
              return { success: false as const, error };
            }
          },
        },
      },
      additionalFiles: { text: "block", binary: "block" },
    });
    const bundle = createBundle({
      rootPath: "MANIFEST.json",
      files: [{ path: "MANIFEST.json", content: '{"name":"demo"}' }],
    });

    expect(schema.parse(bundle).root?.name).toBe("demo");
  });

  it("reports root path and content failures without throwing", () => {
    const schema = bundleSchema({
      root: {
        path: "MANIFEST.json",
        parser: {
          parse: () => ({ success: false as const, error: new Error("bad JSON") }),
        },
      },
      additionalFiles: { text: "block", binary: "block" },
    });

    const wrongRoot = schema.parse(bundleOf([]));
    expect(wrongRoot).toMatchObject({
      success: false,
      findings: [expect.objectContaining({ code: "bundle.root_path", path: "ROOT.md" })],
    });

    const invalidBundle = createBundle({
      rootPath: "MANIFEST.json",
      files: [{ path: "MANIFEST.json", content: "nope" }],
    });
    expect(schema.parse(invalidBundle)).toMatchObject({
      success: false,
      findings: [
        expect.objectContaining({
          code: "bundle.root_content",
          message: "Invalid bundle root: bad JSON",
        }),
      ],
    });
  });

  it("uses explicit rule order as first-match precedence", () => {
    const ignoredFirst = bundleSchema({
      root: { path: "ROOT.md" },
      files: [
        { match: "**/*.md", kind: "any" },
        {
          match: "notes/*.md",
          kind: "text",
          validate: () => [
            { code: "notes.invalid", severity: "block" as const, message: "invalid note" },
          ],
        },
      ],
      additionalFiles: { text: "block", binary: "block" },
    });
    const validatedFirst = bundleSchema({
      ...ignoredFirst.definition,
      files: [...(ignoredFirst.definition.files ?? [])].reverse(),
    });
    const bundle = bundleOf([{ path: "notes/today.md", content: "Today." }]);

    expect(ignoredFirst.parse(bundle).findings).toEqual([]);
    expect(validatedFirst.parse(bundle).findings).toContainEqual(
      expect.objectContaining({ code: "notes.invalid", path: "notes/today.md" }),
    );
  });

  it("applies independent additional-file policies to text and binary files", () => {
    const schema = bundleSchema({
      root: { path: "ROOT.md" },
      additionalFiles: { text: "warn", binary: "block" },
    });
    const result = schema.parse(
      bundleOf([
        { path: "notes.txt", content: "note" },
        { path: "logo.png", bytes: new Uint8Array([1, 2, 3]) },
      ]),
    );

    expect(result.success).toBe(false);
    expect(result.findings).toEqual([
      expect.objectContaining({ path: "logo.png", severity: "block" }),
      expect.objectContaining({ path: "notes.txt", severity: "warn" }),
    ]);
  });

  it("applies one shorthand policy to all additional files", () => {
    const schema = bundleSchema({
      root: { path: "ROOT.md" },
      additionalFiles: "warn",
    });
    const result = schema.parse(
      bundleOf([
        { path: "notes.txt", content: "note" },
        { path: "logo.png", bytes: new Uint8Array([1]) },
      ]),
    );

    expect(result.success).toBe(true);
    expect(result.findings).toEqual([
      expect.objectContaining({ path: "logo.png", severity: "warn" }),
      expect.objectContaining({ path: "notes.txt", severity: "warn" }),
    ]);
  });

  it("lets an any rule claim text or binary content without validation", () => {
    const schema = bundleSchema({
      root: { path: "ROOT.md" },
      files: [{ match: "assets/**", kind: "any" }],
      additionalFiles: { text: "block", binary: "block" },
    });

    expect(
      schema.parse(
        bundleOf([
          { path: "assets/license.txt", content: "License." },
          { path: "assets/logo.png", bytes: new Uint8Array([1]) },
        ]),
      ).findings,
    ).toEqual([]);
  });

  it("blocks binary content claimed by a text rule", () => {
    const schema = bundleSchema({
      root: { path: "ROOT.md" },
      files: [{ match: "queries/*", kind: "text" }],
      additionalFiles: { text: "allow", binary: "allow" },
    });

    expect(
      schema.parse(bundleOf([{ path: "queries/daily.sql", bytes: new Uint8Array([1]) }])).findings,
    ).toContainEqual(expect.objectContaining({ code: "bundle.file_type" }));
  });

  it("blocks text content claimed by a binary rule", () => {
    const schema = bundleSchema({
      root: { path: "ROOT.md" },
      files: [{ match: "assets/*", kind: "binary" }],
      additionalFiles: { text: "allow", binary: "allow" },
    });

    expect(
      schema.parse(bundleOf([{ path: "assets/logo.png", content: "not binary" }])).findings,
    ).toContainEqual(expect.objectContaining({ code: "bundle.file_type" }));
  });

  it("validates nested bundles and re-anchors their findings", () => {
    const child = bundleSchema({
      root: {
        path: "SKILL.md",
        parser: markdownSchema(z.object({ name: z.string(), description: z.string() })),
      },
      additionalFiles: { text: "allow", binary: "block" },
    });
    const parent = bundleSchema({
      root: { path: "ROOT.md" },
      nested: [{ match: "skills/*", schema: child }],
      additionalFiles: { text: "block", binary: "block" },
    });
    const result = parent.parse(
      bundleOf([
        {
          path: "skills/greeter/SKILL.md",
          content: "---\nname: greeter\n---\n\nGreet.",
        },
      ]),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: "bundle.root_content",
        path: "skills/greeter/SKILL.md",
      }),
    );
  });

  it("reports a nested directory that lacks its declared root", () => {
    const child = bundleSchema({
      root: { path: "SKILL.md" },
      additionalFiles: { text: "allow", binary: "block" },
    });
    const parent = bundleSchema({
      root: { path: "ROOT.md" },
      nested: [{ match: "skills/*", schema: child }],
      additionalFiles: { text: "block", binary: "block" },
    });

    expect(
      parent.parse(bundleOf([{ path: "skills/greeter/reference.md", content: "Hi." }])).findings,
    ).toContainEqual(
      expect.objectContaining({
        code: "bundle.nested_root_missing",
        path: "skills/greeter",
      }),
    );
  });

  it("requires at least one owned match when a file rule is required", () => {
    const schema = bundleSchema({
      root: { path: "ROOT.md" },
      files: [{ match: "LICENSE.md", kind: "text", required: true }],
      additionalFiles: "block",
    });

    expect(schema.parse(bundleOf([])).findings).toContainEqual(
      expect.objectContaining({
        code: "bundle.required_file_missing",
        message: "Required file pattern has no matches: LICENSE.md.",
      }),
    );
    expect(schema.parse(bundleOf([{ path: "LICENSE.md", content: "MIT" }])).success).toBe(true);
  });

  it("requires at least one owned directory when a nested rule is required", () => {
    const child = bundleSchema({
      root: { path: "CHAPTER.md" },
      additionalFiles: "allow",
    });
    const schema = bundleSchema({
      root: { path: "ROOT.md" },
      nested: [{ match: "chapters/*", schema: child, required: true }],
      additionalFiles: "block",
    });

    expect(schema.parse(bundleOf([])).findings).toContainEqual(
      expect.objectContaining({
        code: "bundle.required_nested_bundle_missing",
        message: "Required nested bundle pattern has no matches: chapters/*.",
      }),
    );
    expect(
      schema.parse(bundleOf([{ path: "chapters/intro/CHAPTER.md", content: "Introduction" }]))
        .success,
    ).toBe(true);
  });

  it("rejects malformed and duplicate rule patterns at construction time", () => {
    expect(() =>
      bundleSchema({
        root: { path: "ROOT.md" },
        files: [{ match: "notes/**.md", kind: "text" }],
        additionalFiles: { text: "allow", binary: "allow" },
      }),
    ).toThrow("Invalid bundle rule pattern");

    expect(() =>
      bundleSchema({
        root: { path: "ROOT.md" },
        files: [
          { match: "notes/*", kind: "any" },
          { match: "notes/*", kind: "text" },
        ],
        additionalFiles: { text: "allow", binary: "allow" },
      }),
    ).toThrow("Duplicate file pattern");

    expect(() =>
      bundleSchema({
        root: { path: "ROOT.md" },
        nested: [
          {
            match: "skills/**",
            schema: bundleSchema({
              root: { path: "SKILL.md" },
              additionalFiles: { text: "allow", binary: "block" },
            }),
          },
        ],
        additionalFiles: { text: "allow", binary: "allow" },
      }),
    ).toThrow("Nested bundle patterns must have a fixed depth");
  });

  it("rejects malformed runtime schema declarations", () => {
    expect(() =>
      bundleSchema({
        root: { path: "ROOT.md" },
        additionalFiles: "invalid",
      } as never),
    ).toThrow("Bundle schema additionalFiles");

    expect(() =>
      bundleSchema({
        root: { path: "ROOT.md" },
        files: [{ match: "**", kind: "invalid" }],
        additionalFiles: "allow",
      } as never),
    ).toThrow("Invalid bundle file rule kind");

    expect(() =>
      bundleSchema({
        root: { path: "ROOT.md" },
        files: [{ match: "**", kind: "any", required: "yes" }],
        additionalFiles: "allow",
      } as never),
    ).toThrow("required must be a boolean");

    expect(() =>
      bundleSchema({
        root: { path: "ROOT.md", failure: { code: "root.invalid" } },
        additionalFiles: "allow",
      } as never),
    ).toThrow("root rules cannot declare validate or failure");
  });

  it("rejects malformed safe-parser results as programmer errors", () => {
    const schema = bundleSchema({
      root: {
        path: "ROOT.md",
        parser: { parse: () => ({ success: true }) } as never,
      },
      additionalFiles: "allow",
    });

    expect(() => schema.parse(bundleOf([]))).toThrow(
      "Successful safe-parser result must contain data",
    );
  });

  it("rejects malformed validation findings as programmer errors", () => {
    const fileSchema = bundleSchema({
      root: { path: "ROOT.md" },
      files: [
        {
          match: "notes/*",
          kind: "text",
          validate: (() => [{ code: "note.invalid", message: "Invalid note." }]) as never,
        },
      ],
      additionalFiles: "allow",
    });
    expect(() =>
      fileSchema.parse(bundleOf([{ path: "notes/today.md", content: "Today" }])),
    ).toThrow("Validation callback returned an invalid bundle finding");
  });

  it("rejects validation findings with invalid bundle-relative paths", () => {
    const schema = bundleSchema({
      root: { path: "ROOT.md" },
      files: [
        {
          match: "notes/*",
          kind: "text",
          validate: () => [
            {
              code: "note.invalid",
              severity: "block",
              path: "../outside",
              message: "Invalid note.",
            },
          ],
        },
      ],
      additionalFiles: "allow",
    });

    expect(() => schema.parse(bundleOf([{ path: "notes/today.md", content: "Today" }]))).toThrow();
  });

  it("rejects parsers and parser failures on file rules", () => {
    expect(() =>
      bundleSchema({
        root: { path: "ROOT.md" },
        files: [
          {
            match: "notes/*",
            kind: "text",
            failure: { code: "note.invalid" },
          },
        ],
        additionalFiles: "allow",
      } as never),
    ).toThrow("Bundle schema file rules cannot declare parser or failure");
  });

  it("rejects text-only behavior on any and binary rules", () => {
    for (const rule of [
      { match: "assets/**", kind: "any", validate: () => [] },
      {
        match: "images/**",
        kind: "binary",
        parser: { parse: (input: string) => ({ success: true, data: input }) },
      },
    ]) {
      expect(() =>
        bundleSchema({
          root: { path: "ROOT.md" },
          files: [rule],
          additionalFiles: "allow",
        } as never),
      ).toThrow(/cannot declare/);
    }
  });

  it("matches multiple globstars without changing segment semantics", () => {
    const schema = bundleSchema({
      root: { path: "ROOT.md" },
      files: [{ match: "**/examples/**/README.md", kind: "text", required: true }],
      additionalFiles: "block",
    });

    expect(
      schema.parse(
        bundleOf([{ path: "skills/pdf/examples/basic/docs/README.md", content: "Example" }]),
      ).success,
    ).toBe(true);
  });

  it("gives a nested schema atomic ownership of its full subtree", () => {
    const child = bundleSchema({
      root: { path: "SKILL.md" },
      additionalFiles: { text: "block", binary: "block" },
    });
    const parent = bundleSchema({
      root: { path: "ROOT.md" },
      nested: [{ match: "skills/*", schema: child }],
      files: [{ match: "skills/*/README.md", kind: "any" }],
      additionalFiles: { text: "allow", binary: "allow" },
    });
    const result = parent.parse(
      bundleOf([
        { path: "skills/greeter/SKILL.md", content: "Greet." },
        { path: "skills/greeter/README.md", content: "Should remain child-owned." },
      ]),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: "bundle.additional_file",
        path: "skills/greeter/README.md",
        severity: "block",
      }),
    );
  });

  it("gives an outer nested schema precedence over deeper parent rules", () => {
    const inner = bundleSchema({
      root: { path: "EXAMPLE.md" },
      additionalFiles: { text: "allow", binary: "allow" },
    });
    const outer = bundleSchema({
      root: { path: "SKILL.md" },
      additionalFiles: { text: "block", binary: "block" },
    });
    const parent = bundleSchema({
      root: { path: "ROOT.md" },
      nested: [
        { match: "skills/*/examples/*", schema: inner },
        { match: "skills/*", schema: outer },
      ],
      additionalFiles: { text: "allow", binary: "allow" },
    });
    const result = parent.parse(
      bundleOf([
        { path: "skills/greeter/SKILL.md", content: "Greet." },
        { path: "skills/greeter/examples/basic/EXAMPLE.md", content: "Example." },
      ]),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: "bundle.additional_file",
        path: "skills/greeter/examples/basic/EXAMPLE.md",
        severity: "block",
      }),
    );
    expect(result.findings).not.toContainEqual(
      expect.objectContaining({ code: "bundle.nested_root_missing" }),
    );
  });
});
