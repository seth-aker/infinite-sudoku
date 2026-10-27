import { describe, expect, it } from "vitest";
import type { NextFunction, Response } from "express";
import {
  createPuzzleValidator,
  deletePuzzleValidator,
  getPuzzleByIdValidator,
  getPuzzleValidator,
  updatePuzzleValidator,
} from "@/feature/sudoku/middleware/validation/validation";
import { ValidationError } from "@/core/errors/validationError";
import {
  mockNext,
  mockRequest,
  mockResponse,
  type MockRequestInit,
} from "#test/helpers/express";
import { buildUserPuzzle, PUZZLE_ID } from "#test/helpers/fixtures";

type Validator = (req: never, res: Response, next: NextFunction) => void;

function run(validator: Validator, init: MockRequestInit) {
  const next = mockNext();
  let thrown: unknown;
  try {
    validator(mockRequest<never>(init), mockResponse(), next);
  } catch (e) {
    thrown = e;
  }
  return { next, thrown };
}

function expectPass(validator: Validator, init: MockRequestInit) {
  const { next, thrown } = run(validator, init);
  expect(thrown).toBeUndefined();
  expect(next).toHaveBeenCalledWith();
}

function expectFail(validator: Validator, init: MockRequestInit) {
  const { next, thrown } = run(validator, init);
  expect(thrown).toBeInstanceOf(ValidationError);
  expect((thrown as ValidationError).issues.length).toBeGreaterThan(0);
  expect(next).not.toHaveBeenCalled();
  return thrown as ValidationError;
}

describe("sudoku validators", () => {
  describe("getPuzzleValidator", () => {
    it("passes without a difficulty", () => {
      expectPass(getPuzzleValidator, { query: {} });
    });

    it("passes with a valid difficulty", () => {
      expectPass(getPuzzleValidator, { query: { difficulty: "medium" } });
    });

    it("throws for an invalid difficulty", () => {
      const err = expectFail(getPuzzleValidator, {
        query: { difficulty: "expert" },
      });
      expect(err.issues[0]).toMatchObject({
        path: "(root)",
        message: "Invalid difficulty",
      });
    });

    it("throws for repeated difficulty params", () => {
      expectFail(getPuzzleValidator, {
        query: { difficulty: ["easy", "hard"] },
      });
    });
  });

  describe("getPuzzleByIdValidator", () => {
    it("passes for a uuid", () => {
      expectPass(getPuzzleByIdValidator, { params: { puzzleId: PUZZLE_ID } });
    });

    it("throws for a non-uuid", () => {
      const err = expectFail(getPuzzleByIdValidator, {
        params: { puzzleId: "123" },
      });
      expect(err.issues[0].path).toBe("puzzleId");
    });
  });

  describe("createPuzzleValidator", () => {
    it("passes for a valid body", () => {
      expectPass(createPuzzleValidator, {
        body: { cells: [], difficulty: "easy" },
      });
    });

    it("throws for an invalid body", () => {
      expectFail(createPuzzleValidator, { body: {} });
    });
  });

  describe("updatePuzzleValidator", () => {
    it("passes for a valid body", () => {
      expectPass(updatePuzzleValidator, { body: buildUserPuzzle() });
    });

    it("throws for an invalid body", () => {
      expectFail(updatePuzzleValidator, {
        body: buildUserPuzzle({ time: -5 }),
      });
    });

    it("throws for a missing body", () => {
      expectFail(updatePuzzleValidator, { body: undefined });
    });
  });

  describe("deletePuzzleValidator", () => {
    it("passes for an ObjectId", () => {
      expectPass(deletePuzzleValidator, {
        params: { puzzleId: "507f1f77bcf86cd799439011" },
      });
    });

    it("throws for an invalid id", () => {
      expectFail(deletePuzzleValidator, { params: { puzzleId: "x" } });
    });
  });
});
