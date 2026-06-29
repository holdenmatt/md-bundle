import { describe, expect, it } from "vitest";

import { packageName } from "../src/index.js";

describe("public package contract", () => {
  it("exports a placeholder package name", () => {
    expect(packageName).toBe("md-bundle");
  });
});
