import { build } from "esbuild";
import { describe, expect, test } from "vitest";

describe("browser root entry", () => {
  test("bundles without resolving Node builtins", async () => {
    const result = await build({
      entryPoints: ["src/index.ts"],
      platform: "browser",
      bundle: true,
      write: false,
      logLevel: "silent",
    });

    expect(result.outputFiles).toHaveLength(1);
    expect(result.outputFiles[0]!.text).not.toContain("node:");
  });
});
