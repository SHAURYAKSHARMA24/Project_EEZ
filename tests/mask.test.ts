import { describe, it, expect } from "vitest";
import { maskSecret, lineOf } from "../src/mask.ts";

describe("maskSecret", () => {
  it("shows a hint but never the full secret", () => {
    // preflight-ignore-next-line hardcoded-credential -- intentional test fixture
    const masked = maskSecret("sk-ABCDEFGHIJKLMNOP1234");
    expect(masked).toBe("sk-…1234");
    expect(masked).not.toContain("ABCDEFGH");
  });
  it("fully masks short values, including the 8/9-character boundary", () => {
    expect(maskSecret("abcd")).toBe("****");
    expect(maskSecret("abcdefgh")).toBe("********");
    expect(maskSecret("abcdefghi")).toBe("*********");
    expect(maskSecret("abcdefghijklm")).toBe("*************");
  });
});

describe("lineOf", () => {
  it("returns the 1-based line for an index", () => {
    const content = "a\nb\nSECRET";
    expect(lineOf(content, content.indexOf("SECRET"))).toBe(3);
  });
});
