import { describe, expect, it } from "vitest";
import { formatBundleFindings, type BundleFinding } from "../src/schema.js";

describe("formatBundleFindings", () => {
  it("formats path-specific and bundle-wide findings", () => {
    const findings: BundleFinding[] = [
      { code: "root.invalid", severity: "block", path: "ROOT.md", message: "Invalid root." },
      { code: "bundle.empty", severity: "warn", message: "Bundle is empty." },
    ];

    expect(formatBundleFindings(findings)).toBe("ROOT.md: Invalid root.; Bundle is empty.");
  });
});
