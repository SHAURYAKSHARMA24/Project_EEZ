import { describe, it, expect } from "vitest";
import { getVersion } from "../src/version.ts";

describe("getVersion", () => {
  it("returns the package version", () => {
    expect(getVersion()).toBe("0.1.0");
  });
});
