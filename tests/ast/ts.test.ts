import { describe, expect, it } from "vitest";
import ts from "../../src/ast/ts.ts";

describe("TypeScript compiler surface", () => {
  it("exposes the compiler APIs required by the in-memory analyser", () => {
    expect(ts.createProgram).toBeTypeOf("function");
    expect(ts.createSourceFile).toBeTypeOf("function");
    expect(ts.ModuleDetectionKind.Force).toBeDefined();
  });
});
