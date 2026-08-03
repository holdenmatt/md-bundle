import { build } from "esbuild";
import { describe, expect, test } from "vitest";

describe("browser entries", () => {
  test("bundles the core entry without Node builtins or schema code", async () => {
    const result = await build({
      entryPoints: ["src/index.ts"],
      platform: "browser",
      bundle: true,
      metafile: true,
      write: false,
      logLevel: "silent",
    });

    expect(result.outputFiles).toHaveLength(1);
    expect(result.outputFiles[0]!.text).not.toContain("node:");
    expect(Object.keys(result.metafile.inputs)).not.toContain("src/schema.ts");
    expect(Object.keys(result.metafile.inputs)).not.toContain("src/schema-implementation.ts");
    expect(Object.keys(result.metafile.inputs)).not.toContain("src/findings.ts");
  });

  test("bundles the schema entry without resolving Node builtins", async () => {
    const result = await build({
      entryPoints: ["src/schema.ts"],
      platform: "browser",
      bundle: true,
      write: false,
      logLevel: "silent",
    });

    expect(result.outputFiles).toHaveLength(1);
    expect(result.outputFiles[0]!.text).toContain("bundleSchema");
    expect(result.outputFiles[0]!.text).not.toContain("node:");
  });
});
