import { describe, expect, it } from "vitest";
import {
  candidateStringSchema,
  cellSchema,
} from "@/feature/sudoku/middleware/validation/schema/cell";

const validCell = {
  cellId: "a1",
  type: "edited",
  value: 5,
  candidates: new Set([1, 2]),
};

function candidates(cells: string[]) {
  return cells.join(":");
}

describe("cellSchema", () => {
  it("accepts a valid cell", () => {
    expect(cellSchema.safeParse(validCell).success).toBe(true);
  });

  it.each(["prefilled", "edited", "blank"])("accepts type %s", (type) => {
    expect(cellSchema.safeParse({ ...validCell, type }).success).toBe(true);
  });

  it("accepts a null value", () => {
    expect(cellSchema.safeParse({ ...validCell, value: null }).success).toBe(
      true,
    );
  });

  it.each([
    ["unknown type", { type: "other" }, "Invalid cell type"],
    ["string value", { value: "5" }, "Cell value must be a number"],
    ["array candidates", { candidates: [1, 2] }, "Invalid candidates set"],
    [
      "non-numeric candidates",
      { candidates: new Set(["1"]) },
      "Candidate value must be a number",
    ],
  ])("rejects %s", (_label, override, message) => {
    const result = cellSchema.safeParse({ ...validCell, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });

  it("rejects a missing cellId", () => {
    const { cellId: _, ...rest } = validCell;
    expect(cellSchema.safeParse(rest).success).toBe(false);
  });
});

describe("candidateStringSchema", () => {
  it("accepts 81 empty cells", () => {
    expect(candidateStringSchema.safeParse(":".repeat(80)).success).toBe(true);
  });

  it("accepts cells with digits 1-9", () => {
    const cells = Array(81).fill("");
    cells[0] = "123456789";
    cells[40] = "5";
    cells[80] = "19";
    expect(candidateStringSchema.safeParse(candidates(cells)).success).toBe(
      true,
    );
  });

  it.each([
    ["80 cells", ":".repeat(79)],
    ["82 cells", ":".repeat(81)],
    ["an empty string", ""],
  ])("rejects %s", (_label, value) => {
    expect(candidateStringSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    ["a zero", "0"],
    ["letters", "1a"],
    ["more than 9 digits", "1234567891"],
    ["whitespace", " 1"],
    ["negative numbers", "-1"],
  ])("rejects cells containing %s", (_label, cell) => {
    const cells = Array(81).fill("");
    cells[10] = cell;
    expect(candidateStringSchema.safeParse(candidates(cells)).success).toBe(
      false,
    );
  });

  it("rejects non-strings", () => {
    expect(candidateStringSchema.safeParse(81).success).toBe(false);
  });
});
