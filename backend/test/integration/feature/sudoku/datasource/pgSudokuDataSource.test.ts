import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Sql } from "postgres";
import { DatabaseError } from "@/core/errors/databaseError";
import { ErrorType } from "@/core/errors/errorTypes";
import { NotFoundError } from "@/core/errors/notFoundError";
import { PgSudokuDataSource } from "@/feature/sudoku/datasource/pgSudokuDataSource";
import type { UserPuzzleDto } from "@/feature/sudoku/datasource/models/sudokuPuzzle";
import { connect, resetDb } from "#test/integration/helpers/db";
import {
  CELLS,
  EMPTY_CANDIDATES,
  SOLVED_CELLS,
  insertPuzzle,
  insertUser,
  insertUserPuzzle,
} from "#test/integration/helpers/fixtures";

const EASY = { difficulty: "easy" as const };

describe("PgSudokuDataSource", () => {
  let sql: Sql;
  let sudoku: PgSudokuDataSource;

  beforeAll(() => {
    sql = connect();
    // The datasource is a singleton; drop any instance bound to another client.
    PgSudokuDataSource.instance = null;
    sudoku = PgSudokuDataSource.create(sql);
  });

  beforeEach(() => resetDb(sql));

  afterAll(() => sql.end());

  const userPuzzles = (userId: string) =>
    sql`SELECT puzzle_id, cells, is_completed FROM user_puzzles WHERE user_id = ${userId}`;

  const currentPuzzleOf = async (userId: string) => {
    const [row] = await sql<{ current_puzzle_id: string | null }[]>`
      SELECT current_puzzle_id FROM users WHERE user_id = ${userId}
    `;
    return row!.current_puzzle_id;
  };

  describe("getNewPuzzle", () => {
    it("returns a puzzle of the requested difficulty", async () => {
      await insertPuzzle(sql, { difficulty_rating: "hard" });
      const easyId = await insertPuzzle(sql, { difficulty_rating: "easy", difficulty_score: 12 });
      await insertPuzzle(sql, { difficulty_rating: "medium" });

      const { puzzle } = await sudoku.getNewPuzzle(undefined, EASY);
      expect(puzzle).toEqual({ puzzleId: easyId, cells: CELLS, score: 12, rating: "easy" });
    });

    it("never sends the solution", async () => {
      await insertPuzzle(sql);
      const { puzzle } = await sudoku.getNewPuzzle(undefined, EASY);
      expect(JSON.stringify(puzzle)).not.toContain(SOLVED_CELLS);
    });

    it("reports how many puzzles of the difficulty are available", async () => {
      await insertPuzzle(sql);
      await insertPuzzle(sql);
      await insertPuzzle(sql);
      await insertPuzzle(sql, { difficulty_rating: "hard" });

      const { metadata } = await sudoku.getNewPuzzle(undefined, EASY);
      expect(metadata.totalCount).toBe(3);
    });

    it("passes a missing score through as null", async () => {
      await insertPuzzle(sql, { difficulty_score: null });
      const { puzzle } = await sudoku.getNewPuzzle(undefined, EASY);
      expect(puzzle.score).toBeNull();
    });

    it("does not record anything for an anonymous user", async () => {
      await insertPuzzle(sql);
      await sudoku.getNewPuzzle(undefined, EASY);
      expect(await sql`SELECT 1 FROM user_puzzles`).toHaveLength(0);
    });

    it("throws 'No more puzzles' when there are none of the difficulty", async () => {
      await insertPuzzle(sql, { difficulty_rating: "hard" });
      const err = await sudoku.getNewPuzzle(undefined, EASY).catch((e) => e);
      expect(err).toBeInstanceOf(DatabaseError);
      expect(err.message).toBe("No more puzzles");
    });

    describe("for a logged-in user", () => {
      it("only picks puzzles the user has not played", async () => {
        const userId = await insertUser(sql);
        const played = await insertPuzzle(sql);
        const unplayed = await insertPuzzle(sql);
        await insertUserPuzzle(sql, { user_id: userId, puzzle_id: played });

        const { puzzle, metadata } = await sudoku.getNewPuzzle(userId, EASY);
        expect(puzzle.puzzleId).toBe(unplayed);
        expect(metadata.totalCount).toBe(1);
      });

      it("still offers puzzles that other users have played", async () => {
        const userId = await insertUser(sql);
        const otherId = await insertUser(sql);
        const puzzleId = await insertPuzzle(sql);
        await insertUserPuzzle(sql, { user_id: otherId, puzzle_id: puzzleId });

        const { puzzle } = await sudoku.getNewPuzzle(userId, EASY);
        expect(puzzle.puzzleId).toBe(puzzleId);
      });

      it("starts the puzzle for the user and makes it their current puzzle", async () => {
        const userId = await insertUser(sql);
        const puzzleId = await insertPuzzle(sql);

        await sudoku.getNewPuzzle(userId, EASY);

        expect(await userPuzzles(userId)).toEqual([
          { puzzle_id: puzzleId, cells: CELLS, is_completed: false },
        ]);
        expect(await currentPuzzleOf(userId)).toBe(puzzleId);
      });

      it("throws 'No more puzzles' once the user has played them all, changing nothing", async () => {
        const userId = await insertUser(sql);
        const puzzleId = await insertPuzzle(sql);
        await insertUserPuzzle(sql, { user_id: userId, puzzle_id: puzzleId });
        await sql`UPDATE users SET current_puzzle_id = ${puzzleId} WHERE user_id = ${userId}`;

        const err = await sudoku.getNewPuzzle(userId, EASY).catch((e) => e);
        expect(err).toBeInstanceOf(DatabaseError);
        expect(err.message).toBe("No more puzzles");
        expect(await userPuzzles(userId)).toHaveLength(1);
        expect(await currentPuzzleOf(userId)).toBe(puzzleId);
      });
    });
  });

  describe("getPuzzleById", () => {
    it("returns the puzzle including its solution", async () => {
      const puzzleId = await insertPuzzle(sql, { difficulty_score: 33 });
      await expect(sudoku.getPuzzleById(puzzleId)).resolves.toMatchObject({
        puzzle_id: puzzleId,
        cells: CELLS,
        solved_cells: SOLVED_CELLS,
        difficulty_rating: "easy",
        difficulty_score: 33,
      });
    });

    it("throws a NotFoundError for an unknown puzzle", async () => {
      const err = await sudoku.getPuzzleById(crypto.randomUUID()).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.code).toBe(ErrorType.RESOURCE_NOT_FOUND);
    });
  });

  describe("createPuzzles", () => {
    const stored = () =>
      sql`
        SELECT cells, solved_cells, difficulty_score, difficulty_rating
        FROM puzzles ORDER BY difficulty_score NULLS LAST
      `;

    it("stores every puzzle and returns how many were inserted", async () => {
      const count = await sudoku.createPuzzles([
        { cells: "1".repeat(81), solvedCells: "9".repeat(81), score: 1, rating: "medium" },
        { cells: "2".repeat(81), solvedCells: "8".repeat(81), score: 2, rating: "hard" },
      ]);

      expect(count).toBe(2);
      expect(await stored()).toEqual([
        { cells: "1".repeat(81), solved_cells: "9".repeat(81), difficulty_score: 1, difficulty_rating: "medium" },
        { cells: "2".repeat(81), solved_cells: "8".repeat(81), difficulty_score: 2, difficulty_rating: "hard" },
      ]);
    });

    it("stores a missing score as null", async () => {
      await sudoku.createPuzzles([{ cells: CELLS, solvedCells: SOLVED_CELLS, rating: "easy" }]);
      expect(await stored()).toEqual([expect.objectContaining({ difficulty_score: null })]);
    });

    it("makes the new puzzles available to getNewPuzzle", async () => {
      await sudoku.createPuzzles([{ cells: CELLS, solvedCells: SOLVED_CELLS, score: 5, rating: "easy" }]);
      await expect(sudoku.getNewPuzzle(undefined, EASY)).resolves.toMatchObject({
        puzzle: { cells: CELLS, score: 5, rating: "easy" },
      });
    });

    it("does nothing for an empty list", async () => {
      await expect(sudoku.createPuzzles([])).resolves.toBe(0);
      expect(await stored()).toHaveLength(0);
    });
  });

  describe("updateUserPuzzle", () => {
    let userId: string;
    let puzzleId: string;

    beforeEach(async () => {
      userId = await insertUser(sql);
      puzzleId = await insertPuzzle(sql);
    });

    const progress = (overrides: Partial<UserPuzzleDto> = {}): UserPuzzleDto => ({
      puzzleId,
      isCompleted: false,
      cells: "5" + "0".repeat(80),
      candidates: EMPTY_CANDIDATES,
      time: 42,
      actions: [1],
      ...overrides,
    });

    it("saves progress on a started puzzle", async () => {
      await insertUserPuzzle(sql, { user_id: userId, puzzle_id: puzzleId });

      await expect(sudoku.updateUserPuzzle(userId, progress())).resolves.toBe(1);
      await expect(sudoku.getUserPuzzle(userId, puzzleId)).resolves.toMatchObject({
        isCompleted: false,
        cells: "5" + "0".repeat(80),
        time: 42,
        actions: [1],
      });
    });

    it("creates the progress row if the puzzle was never started", async () => {
      await expect(sudoku.updateUserPuzzle(userId, progress())).resolves.toBe(1);
      await expect(sudoku.getUserPuzzle(userId, puzzleId)).resolves.toMatchObject({ time: 42 });
    });

    it("marks a puzzle completed", async () => {
      await insertUserPuzzle(sql, { user_id: userId, puzzle_id: puzzleId });
      await sudoku.updateUserPuzzle(userId, progress({ isCompleted: true, cells: SOLVED_CELLS }));
      await expect(sudoku.getUserPuzzle(userId, puzzleId)).resolves.toMatchObject({
        isCompleted: true,
        cells: SOLVED_CELLS,
      });
    });

    it("leaves a completed puzzle untouched and reports 0 rows updated", async () => {
      await insertUserPuzzle(
        sql,
        { user_id: userId, puzzle_id: puzzleId },
        { is_completed: true, cells: SOLVED_CELLS, time: 300 },
      );

      await expect(sudoku.updateUserPuzzle(userId, progress())).resolves.toBe(0);
      await expect(sudoku.getUserPuzzle(userId, puzzleId)).resolves.toMatchObject({
        isCompleted: true,
        cells: SOLVED_CELLS,
        time: 300,
      });
    });

    it("only changes the given user's progress", async () => {
      const otherId = await insertUser(sql);
      await insertUserPuzzle(sql, { user_id: userId, puzzle_id: puzzleId });
      await insertUserPuzzle(sql, { user_id: otherId, puzzle_id: puzzleId }, { time: 7 });

      await sudoku.updateUserPuzzle(userId, progress());
      await expect(sudoku.getUserPuzzle(otherId, puzzleId)).resolves.toMatchObject({
        cells: CELLS,
        time: 7,
      });
    });

    it("rejects a negative time", async () => {
      await expect(sudoku.updateUserPuzzle(userId, progress({ time: -1 }))).rejects.toThrow();
    });
  });

  describe("getUserPuzzle", () => {
    it("returns the user's progress along with the original puzzle", async () => {
      const userId = await insertUser(sql);
      const puzzleId = await insertPuzzle(sql, { difficulty_rating: "hard", difficulty_score: 77 });
      const cells = "5" + "0".repeat(80);
      await insertUserPuzzle(
        sql,
        { user_id: userId, puzzle_id: puzzleId },
        { cells, time: 42, actions: [1, 2] },
      );

      await expect(sudoku.getUserPuzzle(userId, puzzleId)).resolves.toEqual({
        puzzleId,
        isCompleted: false,
        cells,
        candidates: EMPTY_CANDIDATES,
        time: 42,
        actions: [1, 2],
        originalCells: CELLS,
        rating: "hard",
        score: 77,
      });
    });

    it("throws a NotFoundError when the user has not started the puzzle", async () => {
      const userId = await insertUser(sql);
      const puzzleId = await insertPuzzle(sql);
      const err = await sudoku.getUserPuzzle(userId, puzzleId).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.code).toBe(ErrorType.RESOURCE_NOT_FOUND);
    });

    it("does not return another user's progress", async () => {
      const userId = await insertUser(sql);
      const otherId = await insertUser(sql);
      const puzzleId = await insertPuzzle(sql);
      await insertUserPuzzle(sql, { user_id: otherId, puzzle_id: puzzleId });

      await expect(sudoku.getUserPuzzle(userId, puzzleId)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
