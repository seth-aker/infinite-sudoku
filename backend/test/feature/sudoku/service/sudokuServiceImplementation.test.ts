import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseError } from "@/core/errors/databaseError";
import { NotFoundError } from "@/core/errors/notFoundError";
import { logger } from "@/core/logging/logger";
import type { SudokuDataSource } from "@/feature/sudoku/datasource/sudokuDataSource";
import type { CreatePuzzle, UserPuzzleDto } from "@/feature/sudoku/datasource/models/sudokuPuzzle";
import { SudokuServiceImplementation } from "@/feature/sudoku/service/sudokuServiceImplementation";
import type { SudokuService } from "@/feature/sudoku/service/sudokuService";
import type { WorkerPoolManager } from "@/core/workers/workerpoolManager";
import { expectLogged } from "#test/helpers/logger";

// Stands in for the WorkerPoolManager, which spawns worker threads running
// the C puzzle generator, so tests control when "generated" puzzles arrive.
const pool = { execute: vi.fn() };

const USER_ID = "3f0c7a4e-1b2d-4c5e-8f9a-0b1c2d3e4f5a";
const PUZZLE_ID = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
const PUZZLE = { puzzleId: PUZZLE_ID, cells: "0".repeat(81), rating: "easy" as const, score: 10 };
const SOLVED = "1".repeat(81);
const GENERATED: CreatePuzzle = { cells: "0".repeat(81), rating: "easy", score: 5, solvedCells: SOLVED };
const EASY = { difficulty: "easy" as const };

const withCount = (totalCount: number) => ({ metadata: { totalCount }, puzzle: PUZZLE });
const noMorePuzzles = () => new DatabaseError("No more puzzles");

describe("SudokuServiceImplementation", () => {
  const data = {
    getNewPuzzle: vi.fn(),
    getPuzzleById: vi.fn(),
    getPuzzles: vi.fn(),
    createPuzzles: vi.fn(),
    getUserPuzzle: vi.fn(),
    updateUserPuzzle: vi.fn(),
    deletePuzzle: vi.fn(),
  };
  let service: SudokuService;

  beforeEach(() => {
    // Some tests queue one-off results (mockResolvedValueOnce) that a test may
    // not consume; reset so they can't leak into the next test.
    vi.resetAllMocks();
    SudokuServiceImplementation.instance = null;
    service = SudokuServiceImplementation.create(
      data as unknown as SudokuDataSource,
      pool as unknown as WorkerPoolManager,
    );
    data.getNewPuzzle.mockResolvedValue(withCount(5_000));
    data.createPuzzles.mockResolvedValue(1);
    pool.execute.mockResolvedValue(undefined);
  });

  it("returns the same instance on later create calls", () => {
    expect(
      SudokuServiceImplementation.create({} as SudokuDataSource, {} as WorkerPoolManager),
    ).toBe(service);
  });

  describe("getNewPuzzle", () => {
    it("returns a puzzle for the user and difficulty", async () => {
      await expect(service.getNewPuzzle(USER_ID, EASY)).resolves.toEqual(PUZZLE);
      expect(data.getNewPuzzle).toHaveBeenCalledWith(USER_ID, EASY);
    });

    it("rejects the impossible difficulty without querying", async () => {
      await expect(service.getNewPuzzle(USER_ID, { difficulty: "impossible" as never })).rejects.toThrow(
        "Cannot get difficulty of impossible",
      );
      expect(data.getNewPuzzle).not.toHaveBeenCalled();
    });

    it("does not generate puzzles while 1000 or more remain", async () => {
      data.getNewPuzzle.mockResolvedValue(withCount(1_000));
      await service.getNewPuzzle(USER_ID, EASY);
      expect(pool.execute).not.toHaveBeenCalled();
    });

    describe("when fewer than 1000 puzzles remain", () => {
      beforeEach(() => {
        data.getNewPuzzle.mockResolvedValue(withCount(999));
      });

      it("starts generating 100 more of the same difficulty", async () => {
        await service.getNewPuzzle(USER_ID, EASY);
        expect(pool.execute).toHaveBeenCalledWith("generatePuzzles", [100, EASY], expect.any(Function));
      });

      it("responds without waiting for generation to finish", async () => {
        pool.execute.mockReturnValue(new Promise(() => {}));
        await expect(service.getNewPuzzle(USER_ID, EASY)).resolves.toEqual(PUZZLE);
      });

      it("saves each generated puzzle as it arrives", async () => {
        await service.getNewPuzzle(USER_ID, EASY);
        const onPuzzle = pool.execute.mock.calls[0]![2] as (p: CreatePuzzle) => Promise<void>;
        await onPuzzle(GENERATED);
        expect(data.createPuzzles).toHaveBeenCalledWith([GENERATED]);
        expect(logger.error).not.toHaveBeenCalled();
      });

      it("logs a failed background generation instead of crashing the request or process", async () => {
        const err = new Error("worker crashed");
        pool.execute.mockRejectedValue(err);
        await expect(service.getNewPuzzle(USER_ID, EASY)).resolves.toEqual(PUZZLE);
        // Let the detached rejection settle; an unhandled one would fail the run.
        await new Promise((resolve) => setImmediate(resolve));
        expectLogged("error", expect.objectContaining({ err }));
      });

      it("logs when a generated puzzle fails to save", async () => {
        data.createPuzzles.mockResolvedValue(0);
        await service.getNewPuzzle(USER_ID, EASY);
        const onPuzzle = pool.execute.mock.calls[0]![2] as (p: CreatePuzzle) => Promise<void>;
        await onPuzzle(GENERATED);
        expect(logger.error).toHaveBeenCalledOnce();
      });
    });

    describe("when there are no puzzles left", () => {
      beforeEach(() => {
        data.getNewPuzzle.mockRejectedValueOnce(noMorePuzzles()).mockResolvedValueOnce(withCount(100));
        pool.execute.mockImplementation(async (_name, _args, onPuzzle: (p: CreatePuzzle) => Promise<void>) => {
          await onPuzzle(GENERATED);
        });
      });

      it("generates a single puzzle, waits, then retries", async () => {
        await expect(service.getNewPuzzle(USER_ID, EASY)).resolves.toEqual(PUZZLE);
        expect(pool.execute).toHaveBeenCalledWith("generatePuzzles", [1, EASY], expect.any(Function));
        expect(data.createPuzzles).toHaveBeenCalledWith([GENERATED]);
        expect(data.getNewPuzzle).toHaveBeenCalledTimes(2);
        expect(data.getNewPuzzle).toHaveBeenLastCalledWith(USER_ID, EASY);
      });

      it("logs when a generated puzzle fails to save", async () => {
        data.createPuzzles.mockResolvedValue(0);
        await service.getNewPuzzle(USER_ID, EASY);
        expect(logger.error).toHaveBeenCalledOnce();
      });

      it("propagates a generator failure without retrying", async () => {
        // The user is waiting on this generation, so the real cause should
        // reach the error handler rather than a misleading "No more puzzles".
        const err = new Error("worker crashed");
        pool.execute.mockRejectedValue(err);
        await expect(service.getNewPuzzle(USER_ID, EASY)).rejects.toBe(err);
        expect(data.getNewPuzzle).toHaveBeenCalledOnce();
      });
    });

    it.each([
      ["another DatabaseError", new DatabaseError("connection lost")],
      ["a non-database error", new Error("No more puzzles")],
      ["a NotFoundError", new NotFoundError("nope")],
    ])("rethrows %s without generating", async (_label, err) => {
      data.getNewPuzzle.mockRejectedValue(err);
      await expect(service.getNewPuzzle(USER_ID, EASY)).rejects.toBe(err);
      expect(pool.execute).not.toHaveBeenCalled();
    });
  });

  describe("updateUserPuzzle", () => {
    const progress = (overrides: Partial<UserPuzzleDto> = {}): UserPuzzleDto => ({
      puzzleId: PUZZLE_ID,
      isCompleted: false,
      cells: "0".repeat(81),
      candidates: Array(81).fill("").join(":"),
      time: 60,
      actions: [],
      ...overrides,
    });

    beforeEach(() => {
      data.updateUserPuzzle.mockResolvedValue(1);
      data.getPuzzleById.mockResolvedValue({ puzzle_id: PUZZLE_ID, solved_cells: SOLVED });
    });

    it("saves in-progress puzzles without checking the solution", async () => {
      const puzzle = progress();
      await expect(service.updateUserPuzzle(USER_ID, puzzle)).resolves.toBe(1);
      expect(data.getPuzzleById).not.toHaveBeenCalled();
      expect(data.updateUserPuzzle).toHaveBeenCalledWith(USER_ID, puzzle);
    });

    it("keeps a completion claim that matches the solution", async () => {
      await service.updateUserPuzzle(USER_ID, progress({ isCompleted: true, cells: SOLVED }));
      expect(data.getPuzzleById).toHaveBeenCalledWith(PUZZLE_ID);
      expect(data.updateUserPuzzle).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ isCompleted: true, cells: SOLVED }),
      );
    });

    it("downgrades a completion claim that does not match the solution", async () => {
      await service.updateUserPuzzle(USER_ID, progress({ isCompleted: true, cells: "2".repeat(81) }));
      expect(data.updateUserPuzzle).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ isCompleted: false }),
      );
    });

    it("propagates a missing puzzle when verifying", async () => {
      const err = new NotFoundError("no puzzle");
      data.getPuzzleById.mockRejectedValue(err);
      await expect(
        service.updateUserPuzzle(USER_ID, progress({ isCompleted: true, cells: SOLVED })),
      ).rejects.toBe(err);
      expect(data.updateUserPuzzle).not.toHaveBeenCalled();
    });
  });
});
