import { beforeEach, describe, expect, it } from "vitest";
import { DatabaseError } from "@/core/errors/databaseError";
import { ErrorType } from "@/core/errors/errorTypes";
import { NotFoundError } from "@/core/errors/notFoundError";
import { PgSudokuDataSource } from "@/feature/sudoku/datasource/pgSudokuDataSource";
import type { UserPuzzleDto } from "@/feature/sudoku/datasource/models/sudokuPuzzle";
import { fakeSql, type HelperCall } from "#test/helpers/sql";

const USER_ID = "3f0c7a4e-1b2d-4c5e-8f9a-0b1c2d3e4f5a";
const PUZZLE_ID = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
const CELLS = "0".repeat(81);
const EASY = { difficulty: "easy" as const };

// A row as postgres.js returns it: COUNT(*) OVER () is a bigint, so it comes
// back as a string.
const puzzleRow = (overrides: Record<string, unknown> = {}) => ({
  puzzle_id: PUZZLE_ID,
  cells: CELLS,
  difficulty_score: 42,
  difficulty_rating: "easy",
  created_at: new Date("2026-01-01T00:00:00Z"),
  total_count: "999",
  ...overrides,
});

describe("PgSudokuDataSource", () => {
  let db: ReturnType<typeof fakeSql>;
  let source: PgSudokuDataSource;

  beforeEach(() => {
    db = fakeSql();
    PgSudokuDataSource.instance = null;
    source = PgSudokuDataSource.create(db.sql);
  });

  it("returns the same instance on later create calls", () => {
    expect(PgSudokuDataSource.create(fakeSql().sql)).toBe(source);
  });

  describe("getNewPuzzle", () => {
    it("returns a random puzzle of the difficulty for an anonymous user", async () => {
      db.returns([puzzleRow()]);
      const res = await source.getNewPuzzle(undefined, EASY);

      expect(res.puzzle).toEqual({ puzzleId: PUZZLE_ID, cells: CELLS, score: 42, rating: "easy" });
      expect(db.tag.begin).toHaveBeenCalledOnce();
      expect(db.queries).toHaveLength(1);
      expect(db.queries[0]!.values).toEqual(["easy"]);
      expect(db.queries[0]!.text).toMatch(/ORDER BY RANDOM\(\) LIMIT 1/);
    });

    it("does not filter by played puzzles or record anything for an anonymous user", async () => {
      db.returns([puzzleRow()]);
      await source.getNewPuzzle(undefined, EASY);
      expect(db.queries[0]!.text).not.toMatch(/AND NOT EXISTS/);
      expect(db.queries).toHaveLength(1);
    });

    it("reports how many puzzles remain as a number", async () => {
      db.returns([puzzleRow({ total_count: "999" })]);
      const res = await source.getNewPuzzle(undefined, EASY);
      expect(res.metadata.totalCount).toBe(999);
    });

    it("passes a missing score through", async () => {
      db.returns([puzzleRow({ difficulty_score: null })]);
      const res = await source.getNewPuzzle(undefined, EASY);
      expect(res.puzzle.score).toBeNull();
    });

    describe("for a logged-in user", () => {
      it("only picks puzzles the user has not played", async () => {
        db.returns([puzzleRow()]);
        await source.getNewPuzzle(USER_ID, EASY);
        const [select] = db.queries;
        expect(select!.text).toMatch(/AND NOT EXISTS \( SELECT 1 FROM user_puzzles up/);
        expect(select!.values).toEqual(["easy", USER_ID]);
      });

      it("starts the puzzle for the user and makes it their current puzzle, in the same transaction", async () => {
        db.returns([puzzleRow()]);
        await source.getNewPuzzle(USER_ID, EASY);

        expect(db.tag.begin).toHaveBeenCalledOnce();
        expect(db.queries).toHaveLength(3);
        const [, insert, update] = db.queries;
        expect(insert!.text).toMatch(/INSERT INTO user_puzzles/);
        expect(insert!.values).toEqual([USER_ID, PUZZLE_ID, CELLS]);
        expect(update!.text).toMatch(/UPDATE users SET current_puzzle_id = \$/);
        expect(update!.values).toEqual([PUZZLE_ID, USER_ID]);
      });
    });

    it.each([
      ["an anonymous user", undefined],
      ["a logged-in user", USER_ID],
    ])("throws 'No more puzzles' when none are left for %s", async (_label, userId) => {
      db.returns([]);
      const err = await source.getNewPuzzle(userId, EASY).catch((e) => e);
      expect(err).toBeInstanceOf(DatabaseError);
      expect(err.message).toBe("No more puzzles");
      expect(db.queries).toHaveLength(1);
    });

    it("propagates query failures", async () => {
      const err = new Error("connection lost");
      db.fails(err);
      await expect(source.getNewPuzzle(USER_ID, EASY)).rejects.toBe(err);
    });
  });

  describe("getPuzzleById", () => {
    it("returns the puzzle row", async () => {
      const row = { puzzle_id: PUZZLE_ID, solved_cells: "1".repeat(81) };
      db.returns([row]);
      await expect(source.getPuzzleById(PUZZLE_ID)).resolves.toEqual(row);
      expect(db.queries[0]!.values).toEqual([PUZZLE_ID]);
    });

    it("throws a NotFoundError for an unknown puzzle", async () => {
      db.returns([]);
      const err = await source.getPuzzleById(PUZZLE_ID).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.code).toBe(ErrorType.RESOURCE_NOT_FOUND);
    });
  });

  describe("createPuzzles", () => {
    const puzzle = (n: number) => ({
      cells: String(n).repeat(81),
      solvedCells: "9".repeat(81),
      score: n,
      rating: "medium" as const,
    });

    const insertedRows = () => (db.queries[0]!.values[0] as HelperCall).value;

    it("inserts all puzzles in one query using the table's column names", async () => {
      db.returns([], 2);
      await source.createPuzzles([puzzle(1), puzzle(2)]);
      expect(db.queries).toHaveLength(1);
      expect(db.queries[0]!.text).toMatch(/^INSERT INTO puzzles \$\{helper\}/);
      expect(insertedRows()).toEqual([
        { cells: "1".repeat(81), difficulty_score: 1, difficulty_rating: "medium", solved_cells: "9".repeat(81) },
        { cells: "2".repeat(81), difficulty_score: 2, difficulty_rating: "medium", solved_cells: "9".repeat(81) },
      ]);
    });

    it("returns the number of rows inserted", async () => {
      // An INSERT without RETURNING yields no rows; only count reflects the insert.
      db.returns([], 2);
      await expect(source.createPuzzles([puzzle(1), puzzle(2)])).resolves.toBe(2);
    });

    it("stores a missing score as null", async () => {
      await source.createPuzzles([{ ...puzzle(1), score: undefined }]);
      expect(insertedRows()).toEqual([expect.objectContaining({ difficulty_score: null })]);
    });

    it("does nothing for an empty list", async () => {
      await expect(source.createPuzzles([])).resolves.toBe(0);
      expect(db.queries).toHaveLength(0);
    });

    it("propagates an insert failure", async () => {
      const err = new Error("constraint violated");
      db.fails(err);
      await expect(source.createPuzzles([puzzle(1), puzzle(2)])).rejects.toBe(err);
    });

  });

  describe("updateUserPuzzle", () => {
    const progress: UserPuzzleDto = {
      puzzleId: PUZZLE_ID,
      isCompleted: false,
      cells: CELLS,
      candidates: Array(81).fill("").join(":"),
      time: 90,
      actions: [1, 2],
    };

    const ALL_VALUES = [
      // INSERT ... VALUES
      USER_ID, PUZZLE_ID, CELLS, progress.candidates, 90, [1, 2], false,
      // ON CONFLICT DO UPDATE SET
      false, CELLS, progress.candidates, 90, [1, 2],
    ];

    it("saves the progress in a single upsert and returns the row count", async () => {
      db.returns([], 1);
      await expect(source.updateUserPuzzle(USER_ID, progress)).resolves.toBe(1);
      expect(db.queries).toHaveLength(1);
      const [upsert] = db.queries;
      expect(upsert!.text).toMatch(/^INSERT INTO user_puzzles/);
      expect(upsert!.text).toMatch(/ON CONFLICT \(user_id, puzzle_id\) DO UPDATE/);
      expect(upsert!.values).toEqual(ALL_VALUES);
    });

    it("leaves a completed puzzle untouched", async () => {
      // A conflicting row that's already completed fails the DO UPDATE WHERE,
      // so nothing changes and the count is 0 (not a primary key violation).
      db.returns([], 0);
      await expect(source.updateUserPuzzle(USER_ID, progress)).resolves.toBe(0);
      expect(db.queries[0]!.text).toMatch(/DO UPDATE .* WHERE .*NOT \S*is_completed/);
    });

    // Verified against Postgres 17: inside ON CONFLICT DO UPDATE both the
    // existing row (user_puzzles) and the proposed one (excluded) are in scope.
    it("qualifies the columns in the DO UPDATE WHERE with the table name", async () => {
      // Unqualified, Postgres rejects the whole query (even on a first save):
      //   column reference "user_id" is ambiguous
      await source.updateUserPuzzle(USER_ID, progress);
      const where = db.queries[0]!.text.split(/DO UPDATE .* WHERE/)[1]!;
      expect(where).not.toMatch(/(^|[^.\w])(user_id|puzzle_id|is_completed)\b/);
    });

    it("does not qualify the SET target columns", async () => {
      // Qualified, Postgres rejects the query:
      //   SET target columns cannot be qualified with the relation name.
      await source.updateUserPuzzle(USER_ID, progress);
      const set = db.queries[0]!.text.match(/DO UPDATE SET (.*) WHERE/)![1]!;
      expect(set).not.toMatch(/\w\.\S+ =/);
    });

    it("propagates a query failure", async () => {
      const err = new Error("connection lost");
      db.fails(err);
      await expect(source.updateUserPuzzle(USER_ID, progress)).rejects.toBe(err);
    });
  });

  describe("getUserPuzzle", () => {
    it("returns the user's progress on the puzzle", async () => {
      const row = { puzzleId: PUZZLE_ID, isCompleted: false };
      db.returns([row]);
      await expect(source.getUserPuzzle(USER_ID, PUZZLE_ID)).resolves.toEqual(row);
      expect(db.queries[0]!.values).toEqual([USER_ID, PUZZLE_ID]);
    });

    it("throws a NotFoundError when the user has not started the puzzle", async () => {
      db.returns([]);
      const err = await source.getUserPuzzle(USER_ID, PUZZLE_ID).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.code).toBe(ErrorType.RESOURCE_NOT_FOUND);
    });

    it.each(["puzzleId", "isCompleted", "originalCells"])(
      "quotes the %s alias so Postgres keeps its camelCase",
      async (alias) => {
        db.returns([{}]);
        await source.getUserPuzzle(USER_ID, PUZZLE_ID);
        expect(db.queries[0]!.text).toContain(`as "${alias}"`);
      },
    );

    it("only selects columns that exist on user_puzzles", async () => {
      // user_puzzles has no started_at column in db/schema.sql.
      db.returns([{}]);
      await source.getUserPuzzle(USER_ID, PUZZLE_ID);
      expect(db.queries[0]!.text).not.toMatch(/started_at/);
    });
  });

  describe("unimplemented methods", () => {
    it("getPuzzles throws", async () => {
      await expect(source.getPuzzles(EASY)).rejects.toBeInstanceOf(DatabaseError);
    });

    it("deletePuzzle throws", async () => {
      await expect(source.deletePuzzle(PUZZLE_ID)).rejects.toBeInstanceOf(DatabaseError);
    });
  });
});
