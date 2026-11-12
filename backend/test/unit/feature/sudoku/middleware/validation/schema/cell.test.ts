import { describe, expect, it } from "vitest";
import * as z from "zod/v4";
import { candidateStringSchema } from "@/feature/sudoku/middleware/validation/schema/cell";

const updateBody = (candidates: string) =>
  z.object({ candidates: candidateStringSchema }).safeParse({ candidates });

// 81 cells joined by ":"; each cell holds the digits pencilled into it.
const candidates = (...cells: string[]) =>
  [...cells, ...Array(81 - cells.length).fill("")].join(":");

describe("candidateStringSchema", () => {
  it("accepts 81 empty cells", () => {
    expect(candidateStringSchema.safeParse(candidates()).success).toBe(true);
  });

  it.each([
    ["a single digit", candidates("5")],
    ["all nine digits", candidates("123456789")],
    ["digits in any order", candidates("975")],
    ["candidates in every cell", Array(81).fill("12").join(":")],
  ])("accepts %s", (_label, value) => {
    expect(candidateStringSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    ["80 cells", Array(80).fill("").join(":")],
    ["82 cells", Array(82).fill("").join(":")],
    ["an empty string", ""],
    ["a 0 candidate", candidates("0")],
    ["a letter", candidates("a")],
    ["a negative sign", candidates("-1")],
    ["whitespace", candidates(" 1")],
    ["more than nine digits", candidates("1234567891")],
    ["a comma separator", Array(81).fill("1").join(",")],
  ])("rejects %s", (_label, value) => {
    expect(candidateStringSchema.safeParse(value).success).toBe(false);
  });

  it.each([123, null, undefined, ["1"]])("rejects a non-string (%j)", (value) => {
    expect(candidateStringSchema.safeParse(value).success).toBe(false);
  });

  describe("error messages", () => {
    const issues = (value: string) => candidateStringSchema.safeParse(value).error?.issues ?? [];

    it("reports the number of cells received", () => {
      expect(issues(Array(80).fill("").join(":"))).toEqual([
        expect.objectContaining({ message: "Expected 81 cells, received 80", path: [] }),
      ]);
    });

    it.each([
      ["a 0 candidate", "0", "Candidates must only be values 1-9"],
      ["a letter", "a", "Candidates must only be values 1-9"],
      ["more than nine digits", "1234567891", "Cannot be more than 9 digits"],
    ])("explains %s and points at the cell", (_label, cell, message) => {
      const value = candidates("1", "", cell);
      expect(issues(value)).toEqual([expect.objectContaining({ message, path: [2] })]);
    });

    it("reports only the first bad cell", () => {
      expect(issues(Array(81).fill("a").join(":"))).toHaveLength(1);
    });

    it("returns a single issue for an oversized input instead of one per cell", () => {
      expect(issues(Array(5000).fill("a").join(":"))).toHaveLength(1);
    });
  });

  it("surfaces the cell index in the request path", () => {
    // Nested under the body field, the client sees "candidates.<index>".
    const result = updateBody(candidates("", "", "", "0"));
    expect(result.error?.issues[0]?.path).toEqual(["candidates", 3]);
  });
});

