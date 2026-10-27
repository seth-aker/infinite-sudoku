import { beforeEach, describe, expect, it, vi } from "vitest";
import { SudokuServiceImplementation } from "@/feature/sudoku/service/sudokuServiceImplementation";
import { WorkerPoolManager } from "@/core/workers/workerpoolManager";
import { config as workerConfig } from "@/core/workers/workerpoolConfig";
import { DatabaseError } from "@/core/errors/databaseError";
import { WorkerPoolError } from "@/core/errors/workerpoolError";
import { NotFoundError } from "@/core/errors/notFoundError";
import { logger } from "@/core/logging/logger";
import type { CreatePuzzle } from "@/feature/sudoku/datasource/models/sudokuPuzzle";
import type { SudokuService } from "@/feature/sudoku/service/sudokuService";
import { mockSudokuDataSource } from "#test/helpers/mocks";
import {
  buildSqlPuzzle,
  buildUserPuzzle,
  CELLS,
  PUZZLE_ID,
  SOLVED_CELLS,
  USER_ID,
} from "#test/helpers/fixtures";

const pool = vi.hoisted(() => ({
  configure: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/core/workers/workerpoolManager", () => ({
  WorkerPoolManager: vi.fn(function (this: typeof pool) {
    this.configure = pool.configure;
    this.execute = pool.execute;
  }),
}));

type OnUpdate = (p: CreatePuzzle) => Promise<void>;

const puzzle = {
  puzzleId: PUZZLE_ID,
  cells: CELLS,
  score: 42,
  rating: "easy" as const,
};
const generated: CreatePuzzle = {
  cells: CELLS,
  solvedCells: SOLVED_CELLS,
  score: 1,
  rating: "easy",
};

describe("SudokuServiceImplementation", () => {
  let ds: ReturnType<typeof mockSudokuDataSource>;
  let service: SudokuService;

  beforeEach(() => {
    SudokuServiceImplementation.instance = null;
    ds = mockSudokuDataSource();
    service = SudokuServiceImplementation.create(ds);
    pool.execute.mockResolvedValue(undefined);
  });

  describe("create", () => {
    it("configures a worker pool with the puzzle generator config", () => {
      expect(WorkerPoolManager).toHaveBeenCalledTimes(1);
      expect(pool.configure).toHaveBeenCalledWith(workerConfig);
    });

    it("returns a singleton", () => {
      expect(SudokuServiceImplementation.create(mockSudokuDataSource())).toBe(
        service,
      );
      expect(WorkerPoolManager).toHaveBeenCalledTimes(1);
    });
  });

  describe("getNewPuzzle", () => {
    const options = { difficulty: "easy" as const };

    it("returns the puzzle without generating more when stock is high", async () => {
      ds.getNewPuzzle.mockResolvedValue({
        metadata: { totalCount: 1000 },
        puzzle,
      });
      await expect(service.getNewPuzzle(USER_ID, options)).resolves.toEqual(
        puzzle,
      );
      expect(ds.getNewPuzzle).toHaveBeenCalledWith(USER_ID, options);
      expect(pool.execute).not.toHaveBeenCalled();
    });

    it("generates more puzzles in the background when stock is low", async () => {
      ds.getNewPuzzle.mockResolvedValue({
        metadata: { totalCount: 999 },
        puzzle,
      });
      pool.execute.mockReturnValue(new Promise(() => {}));
      await expect(service.getNewPuzzle(undefined, options)).resolves.toEqual(
        puzzle,
      );
      expect(pool.execute).toHaveBeenCalledWith(
        "generatePuzzles",
        [100, options],
        expect.any(Function),
      );
    });

    it.each([
      ["background", 999, undefined],
      ["fallback", 0, new DatabaseError("No more puzzles")],
    ])(
      "stores puzzles emitted by the generator (%s)",
      async (_label, totalCount, firstError) => {
        if (firstError) ds.getNewPuzzle.mockRejectedValueOnce(firstError);
        ds.getNewPuzzle.mockResolvedValue({
          metadata: { totalCount },
          puzzle,
        });
        ds.createPuzzles.mockResolvedValue(1);
        await service.getNewPuzzle(undefined, options);

        const onUpdate = pool.execute.mock.calls[0][2] as OnUpdate;
        await onUpdate(generated);
        expect(ds.createPuzzles).toHaveBeenCalledWith([generated]);
        expect(logger.error).not.toHaveBeenCalled();

        ds.createPuzzles.mockResolvedValue(0);
        await onUpdate(generated);
        expect(logger.error).toHaveBeenCalledWith(
          "Failed to generate a puzzle",
        );
      },
    );

    it("rejects the impossible difficulty without querying", async () => {
      await expect(
        service.getNewPuzzle(USER_ID, { difficulty: "impossible" }),
      ).rejects.toThrow("Cannot get difficulty of impossible");
      expect(ds.getNewPuzzle).not.toHaveBeenCalled();
      expect(pool.execute).not.toHaveBeenCalled();
    });

    it("generates puzzles and retries when none are left", async () => {
      ds.getNewPuzzle
        .mockRejectedValueOnce(new DatabaseError("No more puzzles"))
        .mockResolvedValueOnce({ metadata: { totalCount: 100 }, puzzle });

      await expect(service.getNewPuzzle(USER_ID, options)).resolves.toEqual(
        puzzle,
      );
      expect(pool.execute).toHaveBeenCalledTimes(1);
      expect(pool.execute).toHaveBeenCalledWith(
        "generatePuzzles",
        [100, options],
        expect.any(Function),
      );
      expect(ds.getNewPuzzle).toHaveBeenCalledTimes(2);
    });

    it("waits for generation to finish before retrying", async () => {
      const order: string[] = [];
      ds.getNewPuzzle
        .mockRejectedValueOnce(new DatabaseError("No more puzzles"))
        .mockImplementationOnce(async () => {
          order.push("retry");
          return { metadata: { totalCount: 100 }, puzzle };
        });
      pool.execute.mockImplementationOnce(async () => {
        order.push("generate");
      });
      await service.getNewPuzzle(USER_ID, options);
      expect(order).toEqual(["generate", "retry"]);
    });

    it("propagates generator failures during the fallback", async () => {
      ds.getNewPuzzle.mockRejectedValueOnce(
        new DatabaseError("No more puzzles"),
      );
      pool.execute.mockRejectedValueOnce(new WorkerPoolError("crashed"));
      await expect(service.getNewPuzzle(USER_ID, options)).rejects.toThrow(
        WorkerPoolError,
      );
      expect(ds.getNewPuzzle).toHaveBeenCalledTimes(1);
    });

    it("propagates a second 'No more puzzles' failure", async () => {
      ds.getNewPuzzle.mockRejectedValue(new DatabaseError("No more puzzles"));
      await expect(service.getNewPuzzle(USER_ID, options)).rejects.toThrow(
        "No more puzzles",
      );
      expect(pool.execute).toHaveBeenCalledTimes(1);
    });

    it("rethrows other database errors", async () => {
      const err = new DatabaseError("connection lost");
      ds.getNewPuzzle.mockRejectedValue(err);
      await expect(service.getNewPuzzle(USER_ID, options)).rejects.toBe(err);
      expect(pool.execute).not.toHaveBeenCalled();
    });

    it("rethrows non-database errors mentioning no more puzzles", async () => {
      const err = new Error("No more puzzles");
      ds.getNewPuzzle.mockRejectedValue(err);
      await expect(service.getNewPuzzle(USER_ID, options)).rejects.toBe(err);
      expect(pool.execute).not.toHaveBeenCalled();
    });
  });

  describe("delegation", () => {
    it("getPuzzles", async () => {
      const arr = {
        metadata: { totalCount: 0, page: 1, limit: 5 },
        puzzles: [],
      };
      ds.getPuzzles.mockResolvedValue(arr);
      await expect(
        service.getPuzzles({ difficulty: "easy" }, 1, 5),
      ).resolves.toBe(arr);
      expect(ds.getPuzzles).toHaveBeenCalledWith({ difficulty: "easy" }, 1, 5);
    });

    it("createPuzzles", async () => {
      ds.createPuzzles.mockResolvedValue(1);
      await expect(service.createPuzzles([generated])).resolves.toBe(1);
      expect(ds.createPuzzles).toHaveBeenCalledWith([generated]);
    });

    it("getUserPuzzle", async () => {
      const up = buildUserPuzzle();
      ds.getUserPuzzle.mockResolvedValue(up);
      await expect(service.getUserPuzzle(USER_ID, PUZZLE_ID)).resolves.toBe(up);
      expect(ds.getUserPuzzle).toHaveBeenCalledWith(USER_ID, PUZZLE_ID);
    });

    it("getUserPuzzle propagates not found", async () => {
      ds.getUserPuzzle.mockRejectedValue(new NotFoundError("x"));
      await expect(
        service.getUserPuzzle(USER_ID, PUZZLE_ID),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("deletePuzzle", async () => {
      ds.deletePuzzle.mockResolvedValue(1);
      await expect(service.deletePuzzle(PUZZLE_ID)).resolves.toBe(1);
      expect(ds.deletePuzzle).toHaveBeenCalledWith(PUZZLE_ID);
    });
  });

  describe("updateUserPuzzle", () => {
    beforeEach(() => {
      ds.updateUserPuzzle.mockResolvedValue(1);
    });

    it("saves in-progress puzzles without checking the solution", async () => {
      const up = buildUserPuzzle({ isCompleted: false });
      await expect(service.updateUserPuzzle(USER_ID, up)).resolves.toBe(1);
      expect(ds.getPuzzleById).not.toHaveBeenCalled();
      expect(ds.updateUserPuzzle).toHaveBeenCalledWith(USER_ID, up);
    });

    it("marks the puzzle complete when the cells match the solution", async () => {
      ds.getPuzzleById.mockResolvedValue(buildSqlPuzzle());
      const up = buildUserPuzzle({ isCompleted: true, cells: SOLVED_CELLS });
      await service.updateUserPuzzle(USER_ID, up);
      expect(ds.getPuzzleById).toHaveBeenCalledWith(PUZZLE_ID);
      expect(ds.updateUserPuzzle.mock.calls[0][1].isCompleted).toBe(true);
    });

    it("clears a false completion claim", async () => {
      ds.getPuzzleById.mockResolvedValue(buildSqlPuzzle());
      const up = buildUserPuzzle({ isCompleted: true, cells: CELLS });
      await service.updateUserPuzzle(USER_ID, up);
      expect(ds.updateUserPuzzle.mock.calls[0][1].isCompleted).toBe(false);
    });

    it("propagates errors when the puzzle does not exist", async () => {
      ds.getPuzzleById.mockRejectedValue(new NotFoundError("nope"));
      await expect(
        service.updateUserPuzzle(
          USER_ID,
          buildUserPuzzle({ isCompleted: true }),
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(ds.updateUserPuzzle).not.toHaveBeenCalled();
    });
  });
});
