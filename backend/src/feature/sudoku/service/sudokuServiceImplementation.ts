import { SudokuDataSource } from "../datasource/sudokuDataSource";
import { PuzzleArray } from "../datasource/models/puzzleArray";
import { type PuzzleOptions } from "../datasource/models/puzzleOptions";
import {
  SudokuPuzzle,
  CreatePuzzle,
  UserPuzzleDto,
} from "../datasource/models/sudokuPuzzle";
import { SudokuService } from "./sudokuService";
import { WorkerPoolManager } from "@/core/workers/workerpoolManager";
import { DatabaseError } from "@/core/errors/databaseError";
import { config } from "@/core/workers/workerpoolConfig";
import { logger } from "@/core/logging/logger";
export class SudokuServiceImplementation implements SudokuService {
  private sudokuDataSource: SudokuDataSource;
  private workerpoolManager: WorkerPoolManager;
  private constructor(dataSource: SudokuDataSource) {
    this.sudokuDataSource = dataSource;
    this.workerpoolManager = new WorkerPoolManager();
    this.workerpoolManager.configure(config);
  }
  static instance: SudokuService | null = null;
  static create(dataSource: SudokuDataSource) {
    if (SudokuServiceImplementation.instance === null) {
      SudokuServiceImplementation.instance = new SudokuServiceImplementation(
        dataSource,
      );
    }
    return SudokuServiceImplementation.instance;
  }

  async getNewPuzzle(
    requestedBy: string | undefined,
    options: PuzzleOptions,
  ): Promise<SudokuPuzzle> {
    try {
      if (options.difficulty === "impossible") {
        throw new Error("Cannot get difficulty of impossible");
      }
      const response = await this.sudokuDataSource.getNewPuzzle(
        requestedBy,
        options,
      );
      if (response.metadata.totalCount < 1000) {
        this.workerpoolManager.execute(
          "generatePuzzles",
          [100, options],
          async (newPuzzle: CreatePuzzle) => {
            const result = await this.createPuzzles([newPuzzle]);
            if (result !== 1) {
              logger.error("Failed to generate a puzzle");
            }
          },
        );
      }
      return response.puzzle;
    } catch (err) {
      if (
        err instanceof DatabaseError &&
        err.message.includes("No more puzzles")
      ) {
        await this.workerpoolManager.execute(
          "generatePuzzles",
          [100, options],
          async (newPuzzles: CreatePuzzle) => {
            const result = await this.createPuzzles([newPuzzles]);
            if (result != 1) {
              logger.error("Failed to generate a puzzle");
            }
          },
        );
        const response = await this.sudokuDataSource.getNewPuzzle(
          requestedBy,
          options,
        );
        return response.puzzle;
      } else {
        throw err;
      }
    }
  }
  async getPuzzles(
    options: PuzzleOptions,
    page?: number,
    limit?: number,
  ): Promise<PuzzleArray> {
    return await this.sudokuDataSource.getPuzzles(options, page, limit);
  }
  async createPuzzles(puzzles: CreatePuzzle[]): Promise<number> {
    return await this.sudokuDataSource.createPuzzles(puzzles);
  }
  async getUserPuzzle(
    userId: string,
    puzzleId: string,
  ): Promise<UserPuzzleDto> {
    return await this.sudokuDataSource.getUserPuzzle(
      userId,
      puzzleId,
    );
  }
  async updateUserPuzzle(
    userId: string,
    puzzle: UserPuzzleDto,
  ): Promise<number> {
    // don't trust that the puzzle is actually complete, verfiy
    if (puzzle.isCompleted) {
      const existingPuzzle = await this.sudokuDataSource.getPuzzleById(
        puzzle.puzzleId,
      );
      puzzle.isCompleted = existingPuzzle.solved_cells === puzzle.cells;
    }
    // TODO: add checks to prevent cheating
    return await this.sudokuDataSource.updateUserPuzzle(userId, puzzle);
  }
  async deletePuzzle(puzzleId: string): Promise<number> {
    return await this.sudokuDataSource.deletePuzzle(puzzleId);
  }
}
