import { beforeEach, describe, expect, it } from "vitest";
import { PgSudokuDataSource } from "@/feature/sudoku/datasource/pgSudokuDataSource";
import { DatabaseError } from "@/core/errors/databaseError";
import { NotFoundError } from "@/core/errors/notFoundError";
import { ErrorType } from "@/core/errors/errorTypes";
import { createSqlMock, result, type SqlMock } from "#test/helpers/sql";
import {
  buildSqlPuzzle,
  buildUserPuzzle,
  CELLS,
  PUZZLE_ID,
  SOLVED_CELLS,
  USER_ID,
} from "#test/helpers/fixtures";

describe("PgSudokuDataSource", () => {
  let db: SqlMock;
  let source: PgSudokuDataSource;

  beforeEach(() => {
    PgSudokuDataSource.instance = null;
    db = createSqlMock();
    source = PgSudokuDataSource.create(db.sql);
  });

  it("is a singleton", () => {
    expect(PgSudokuDataSource.create(createSqlMock().sql)).toBe(source);
  });

  describe("getNewPuzzle", () => {
    const row = { ...buildSqlPuzzle(), total_count: 1500 };
    const expected = {
      metadata: { totalCount: 1500 },
      puzzle: {
        puzzleId: PUZZLE_ID,
        cells: CELLS,
        score: 42,
        rating: "easy",
      },
    };

    it("returns a random puzzle for anonymous users without recording it", async () => {
      db.enqueue(result([row]));
      await expect(
        source.getNewPuzzle(undefined, { difficulty: "easy" }),
      ).resolves.toEqual(expected);

      expect(db.begin).toHaveBeenCalledTimes(1);
      expect(db.executedCalls).toHaveLength(1);
      const select = db.executedCalls[0];
      expect(select.query).toContain("FROM puzzles p");
      expect(select.query).toContain("ORDER BY RANDOM()");
      expect(select.values[0]).toBe("easy");
      const fragment = db.calls.find((c) => c !== select)!;
      expect(fragment.query).toBe("");
    });

    it("excludes already-played puzzles and records the puzzle for users", async () => {
      db.enqueue(result([row]));
      await expect(
        source.getNewPuzzle(USER_ID, { difficulty: "hard" }),
      ).resolves.toEqual(expected);

      const [select, insert, update] = db.executedCalls;
      expect(select.values[0]).toBe("hard");
      const fragment = db.calls.find((c) => c.query.includes("NOT EXISTS"))!;
      expect(fragment.values).toEqual([USER_ID]);

      expect(insert.query).toContain("INSERT INTO user_puzzles");
      expect(insert.values).toEqual([USER_ID, PUZZLE_ID, CELLS]);
      expect(update.query).toContain("SET current_puzzle_id");
      expect(update.values).toEqual([PUZZLE_ID, USER_ID]);
    });

    it.each([undefined, USER_ID])(
      "throws 'No more puzzles' when none are available (user: %s)",
      async (userId) => {
        db.enqueue(result([]));
        const err = await source
          .getNewPuzzle(userId, { difficulty: "easy" })
          .catch((e) => e);
        expect(err).toBeInstanceOf(DatabaseError);
        expect(err.message).toBe("No more puzzles");
        expect(db.executedCalls).toHaveLength(1);
      },
    );

    it("throws 'No more puzzles' when total_count is 0", async () => {
      db.enqueue(result([{ ...row, total_count: 0 }]));
      await expect(
        source.getNewPuzzle(undefined, { difficulty: "easy" }),
      ).rejects.toThrow("No more puzzles");
    });

    it("propagates transaction failures", async () => {
      db.enqueue(result([row]), new Error("insert failed"));
      await expect(
        source.getNewPuzzle(USER_ID, { difficulty: "easy" }),
      ).rejects.toThrow("insert failed");
    });
  });

  describe("getPuzzleById", () => {
    it("returns the puzzle row", async () => {
      const puzzle = buildSqlPuzzle();
      db.enqueue(result([puzzle]));
      await expect(source.getPuzzleById(PUZZLE_ID)).resolves.toEqual(puzzle);
      expect(db.calls[0].query).toBe(
        "SELECT * FROM puzzles WHERE puzzle_id = $;",
      );
      expect(db.calls[0].values).toEqual([PUZZLE_ID]);
    });

    it("throws NotFoundError when missing", async () => {
      db.enqueue(result([]));
      const err = await source.getPuzzleById(PUZZLE_ID).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.code).toBe(ErrorType.RESOURCE_NOT_FOUND);
      expect(err.message).toBe(`Puzzle with id: ${PUZZLE_ID} not found`);
    });
  });

  describe("getPuzzles", () => {
    it("is not implemented", async () => {
      await expect(
        source.getPuzzles({ difficulty: "easy" }, 1, 10),
      ).rejects.toThrow(new DatabaseError("Not implemented"));
      expect(db.calls).toHaveLength(0);
    });
  });

  describe("createPuzzles", () => {
    it("inserts each puzzle and returns the number of inserts", async () => {
      const count = await source.createPuzzles([
        { cells: CELLS, solvedCells: SOLVED_CELLS, score: 10, rating: "easy" },
        { cells: CELLS, solvedCells: SOLVED_CELLS, rating: "hard" },
      ]);
      expect(count).toBe(2);
      expect(db.executedCalls).toHaveLength(2);
      expect(db.calls[0].query).toContain("INSERT INTO puzzles");
      expect(db.calls[0].values).toEqual([CELLS, SOLVED_CELLS, 10, "easy"]);
      expect(db.calls[1].values).toEqual([CELLS, SOLVED_CELLS, null, "hard"]);
    });

    it("keeps a score of 0", async () => {
      await source.createPuzzles([
        { cells: CELLS, solvedCells: SOLVED_CELLS, score: 0, rating: "easy" },
      ]);
      expect(db.calls[0].values[2]).toBe(0);
    });

    it("returns 0 for an empty list", async () => {
      await expect(source.createPuzzles([])).resolves.toBe(0);
      expect(db.calls).toHaveLength(0);
    });

    it("rejects if any insert fails", async () => {
      db.enqueue(result([]), new Error("dup"));
      await expect(
        source.createPuzzles([
          { cells: CELLS, solvedCells: SOLVED_CELLS, rating: "easy" },
          { cells: CELLS, solvedCells: SOLVED_CELLS, rating: "easy" },
        ]),
      ).rejects.toThrow("dup");
    });
  });

  describe("updateUserPuzzle", () => {
    const puzzle = buildUserPuzzle({ isCompleted: true, time: 99 });

    it("updates an in-progress puzzle", async () => {
      db.enqueue(result([], 1));
      await expect(source.updateUserPuzzle(USER_ID, puzzle)).resolves.toBe(1);
      expect(db.calls).toHaveLength(1);
      expect(db.calls[0].query).toContain("UPDATE user_puzzles");
      expect(db.calls[0].query).toContain("NOT is_completed");
      expect(db.calls[0].values).toEqual([
        true,
        puzzle.cells,
        puzzle.candidates,
        99,
        puzzle.actions,
        USER_ID,
        PUZZLE_ID,
      ]);
    });

    it("inserts the puzzle when nothing was updated", async () => {
      db.enqueue(result([], 0), result([], 1));
      await expect(source.updateUserPuzzle(USER_ID, puzzle)).resolves.toBe(1);
      expect(db.calls[1].query).toContain("INSERT INTO user_puzzles");
      expect(db.calls[1].values).toEqual([
        USER_ID,
        PUZZLE_ID,
        puzzle.cells,
        puzzle.candidates,
        99,
        puzzle.actions,
        true,
      ]);
    });

    it("returns the insert count when the insert affects no rows", async () => {
      db.enqueue(result([], 0), result([], 0));
      await expect(source.updateUserPuzzle(USER_ID, puzzle)).resolves.toBe(0);
    });

    it("propagates insert errors such as completed puzzle conflicts", async () => {
      db.enqueue(result([], 0), new Error("duplicate key"));
      await expect(source.updateUserPuzzle(USER_ID, puzzle)).rejects.toThrow(
        "duplicate key",
      );
    });
  });

  describe("getUserPuzzle", () => {
    it("returns the user's puzzle", async () => {
      const row = buildUserPuzzle();
      db.enqueue(result([row]));
      await expect(source.getUserPuzzle(USER_ID, PUZZLE_ID)).resolves.toBe(row);
      expect(db.calls[0].query).toContain("FROM user_puzzles AS up");
      expect(db.calls[0].values).toEqual([USER_ID, PUZZLE_ID]);
    });

    it("throws NotFoundError when missing", async () => {
      db.enqueue(result([]));
      const err = await source
        .getUserPuzzle(USER_ID, PUZZLE_ID)
        .catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.message).toBe(`No puzzle with id: ${PUZZLE_ID} found`);
    });
  });

  describe("deletePuzzle", () => {
    it("is not implemented", async () => {
      await expect(source.deletePuzzle(PUZZLE_ID)).rejects.toThrow(
        "Fn deletePuzzle() not implemented",
      );
    });
  });
});
