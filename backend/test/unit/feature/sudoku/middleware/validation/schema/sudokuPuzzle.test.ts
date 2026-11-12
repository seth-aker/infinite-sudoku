import { describe, expect, it } from "vitest";
import {
  getPuzzleByIdSchema,
  getPuzzleSchema,
  updateUserPuzzleSchema,
} from "@/feature/sudoku/middleware/validation/schema/sudokuPuzzle";

const PUZZLE_ID = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

describe("getPuzzleSchema", () => {
  it("accepts a missing difficulty (the route defaults to easy)", () => {
    expect(getPuzzleSchema.safeParse(undefined).success).toBe(true);
  });

  it("accepts a valid difficulty", () => {
    expect(getPuzzleSchema.parse("hard")).toBe("hard");
  });

  it.each(["", "extreme", ["easy", "hard"]])("rejects %j", (value) => {
    expect(getPuzzleSchema.safeParse(value).success).toBe(false);
  });
});

describe("getPuzzleByIdSchema", () => {
  it("accepts a uuid puzzleId", () => {
    expect(getPuzzleByIdSchema.safeParse({ puzzleId: PUZZLE_ID }).success).toBe(true);
  });

  it.each([
    ["a non-uuid", { puzzleId: "abc" }],
    ["a Mongo ObjectId", { puzzleId: "507f1f77bcf86cd799439011" }],
    ["a missing puzzleId", {}],
  ])("rejects %s", (_label, params) => {
    expect(getPuzzleByIdSchema.safeParse(params).success).toBe(false);
  });
});

describe("updateUserPuzzleSchema", () => {
  const valid = {
    puzzleId: PUZZLE_ID,
    cells: "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
    candidates: Array(81).fill("").join(":"),
    isCompleted: false,
    actions: [1, 2, 3],
    time: 120,
  };

  const issuePaths = (body: unknown) =>
    updateUserPuzzleSchema.safeParse(body).error?.issues.map((i) => i.path.join("."));

  it("accepts a valid body", () => {
    expect(updateUserPuzzleSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["zero time", { time: 0 }],
    ["no actions", { actions: [] }],
    ["a completed puzzle", { isCompleted: true }],
  ])("accepts %s", (_label, override) => {
    expect(updateUserPuzzleSchema.safeParse({ ...valid, ...override }).success).toBe(true);
  });

  it.each([
    ["a non-uuid puzzleId", { puzzleId: "abc" }, "puzzleId"],
    ["cells shorter than 81", { cells: "0".repeat(80) }, "cells"],
    ["cells longer than 81", { cells: "0".repeat(82) }, "cells"],
    ["non-digit cells", { cells: "x".repeat(81) }, "cells"],
    ["bad candidates", { candidates: "1:2:3" }, "candidates"],
    ["a string isCompleted", { isCompleted: "false" }, "isCompleted"],
    ["non-numeric actions", { actions: ["1"] }, "actions.0"],
    ["fractional actions", { actions: [1.5] }, "actions.0"],
    ["a negative time", { time: -1 }, "time"],
    ["a fractional time", { time: 1.5 }, "time"],
    ["a string time", { time: "120" }, "time"],
  ])("rejects %s", (_label, override, path) => {
    expect(issuePaths({ ...valid, ...override })).toContain(path);
  });

  it.each(["puzzleId", "cells", "candidates", "isCompleted", "actions", "time"])(
    "requires %s",
    (field) => {
      const body: Record<string, unknown> = { ...valid };
      delete body[field];
      expect(issuePaths(body)).toContain(field);
    },
  );

  it("explains the cells length rule", () => {
    const result = updateUserPuzzleSchema.safeParse({ ...valid, cells: "0" });
    expect(result.error?.issues[0]?.message).toBe("Error, cell string must be 81 digits long");
  });

  it("explains the negative time rule", () => {
    const result = updateUserPuzzleSchema.safeParse({ ...valid, time: -5 });
    expect(result.error?.issues[0]?.message).toBe("Time cannot be a negative integer");
  });
});
