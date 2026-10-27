import { describe, expect, it } from "vitest";
import {
  createPuzzleSchema,
  deletePuzzleSchema,
  getPuzzleByIdSchema,
  getPuzzleSchema,
  updateUserPuzzleSchema,
} from "@/feature/sudoku/middleware/validation/schema/sudokuPuzzle";
import { buildUserPuzzle, PUZZLE_ID } from "#test/helpers/fixtures";

describe("getPuzzleByIdSchema", () => {
  it("accepts a uuid", () => {
    expect(getPuzzleByIdSchema.safeParse({ puzzleId: PUZZLE_ID }).success).toBe(
      true,
    );
  });

  it.each(["abc", "", undefined])("rejects %j", (puzzleId) => {
    expect(getPuzzleByIdSchema.safeParse({ puzzleId }).success).toBe(false);
  });
});

describe("getPuzzleSchema", () => {
  it("accepts undefined", () => {
    expect(getPuzzleSchema.safeParse(undefined).success).toBe(true);
  });

  it("accepts a difficulty", () => {
    expect(getPuzzleSchema.safeParse("hard").success).toBe(true);
  });

  it("rejects an unknown difficulty", () => {
    expect(getPuzzleSchema.safeParse("expert").success).toBe(false);
  });
});

describe("createPuzzleSchema", () => {
  const cell = {
    cellId: "a1",
    type: "blank",
    value: null,
    candidates: new Set<number>(),
  };

  it("accepts a grid of cells and a difficulty", () => {
    expect(
      createPuzzleSchema.safeParse({ cells: [[cell]], difficulty: "easy" })
        .success,
    ).toBe(true);
  });

  it.each([
    ["non-array rows", { cells: {} }, "Invalid row array"],
    ["non-array cells", { cells: [{}] }, "Invalid cell array"],
    ["invalid difficulty", { difficulty: "x" }, "Invalid difficulty"],
  ])("rejects %s", (_label, override, message) => {
    const result = createPuzzleSchema.safeParse({
      cells: [[cell]],
      difficulty: "easy",
      ...override,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });
});

describe("updateUserPuzzleSchema", () => {
  const valid = buildUserPuzzle();

  it("accepts a valid update", () => {
    expect(updateUserPuzzleSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts zero time and empty actions", () => {
    expect(
      updateUserPuzzleSchema.safeParse({ ...valid, time: 0, actions: [] })
        .success,
    ).toBe(true);
  });

  it.each([
    [
      "80 char cells",
      { cells: "0".repeat(80) },
      "Error, cell string must be 81 numbers long",
    ],
    [
      "82 char cells",
      { cells: "0".repeat(82) },
      "Error, cell string must be 81 numbers long",
    ],
    ["negative time", { time: -1 }, "Time cannot be a negative integer"],
  ])("rejects %s with a message", (_label, override, message) => {
    const result = updateUserPuzzleSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });

  it.each([
    ["non-uuid puzzleId", { puzzleId: "abc" }],
    ["bad candidates", { candidates: "x" }],
    ["string isCompleted", { isCompleted: "true" }],
    ["non-numeric actions", { actions: ["1"] }],
    ["string time", { time: "10" }],
    ["missing cells", { cells: undefined }],
  ])("rejects %s", (_label, override) => {
    expect(
      updateUserPuzzleSchema.safeParse({ ...valid, ...override }).success,
    ).toBe(false);
  });

  it("accepts non-digit characters in cells as long as length is 81", () => {
    expect(
      updateUserPuzzleSchema.safeParse({ ...valid, cells: "x".repeat(81) })
        .success,
    ).toBe(true);
  });
});

describe("deletePuzzleSchema", () => {
  it("accepts an ObjectId", () => {
    expect(
      deletePuzzleSchema.safeParse({ puzzleId: "507f1f77bcf86cd799439011" })
        .success,
    ).toBe(true);
  });

  it("rejects a uuid", () => {
    expect(deletePuzzleSchema.safeParse({ puzzleId: PUZZLE_ID }).success).toBe(
      false,
    );
  });
});
