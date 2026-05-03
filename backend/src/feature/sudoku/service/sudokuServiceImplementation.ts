import { SudokuDataSource } from "../datasource/sudokuDataSource";
import { PuzzleArray } from "../datasource/models/puzzleArray";
import { type PuzzleOptions} from "../datasource/models/puzzleOptions";
import { SudokuPuzzle, CreatePuzzle, UpdatePuzzle, UserPuzzleDto } from "../datasource/models/sudokuPuzzle";
import { SudokuService } from "./sudokuService";
import { BaseService } from "../../../core/service/baseService";
import { WorkerPoolManager } from "@/core/workers/workerpoolManager";
import { DatabaseError } from "@/core/errors/databaseError";
import { config } from "@/core/workers/workerpoolConfig";
export class SudokuServiceImplementation extends BaseService implements SudokuService {
  private sudokuDataSource: SudokuDataSource;
  private workerpoolManager: WorkerPoolManager;
  private constructor(dataSource: SudokuDataSource) {
    super();
    this.sudokuDataSource = dataSource;
    this.workerpoolManager = new WorkerPoolManager();
    this.workerpoolManager.configure(config)
  }
  static instance: SudokuService | null = null;
  static create(dataSource: SudokuDataSource) {
    if(SudokuServiceImplementation.instance === null) {
      SudokuServiceImplementation.instance = new SudokuServiceImplementation(dataSource);
    }
    return SudokuServiceImplementation.instance
  }

  async getNewPuzzle(requestedBy: string | undefined, options: PuzzleOptions): Promise<SudokuPuzzle>{
    return await this.callDataSource(async () => {
      try {
        if(options.difficulty == "hard" || options.difficulty === 'impossible') {
          throw new Error("Cannot get difficulties of hard or impossible") 
        }
        const response = await this.sudokuDataSource.getNewPuzzle(requestedBy, options);
        if(response.metadata.totalCount < 1000) {
          this.workerpoolManager.execute('generatePuzzles', [100, options], async (newPuzzle: CreatePuzzle) => {
            const result = await this.createPuzzles([newPuzzle]);
            if(result !== 1) {
              console.log("A puzzle failed to be created in the database")
            }
          })
        }
        return response.puzzle
      } catch (err) {
        if(err instanceof DatabaseError && err.message.includes('No more puzzles')) {
          await this.workerpoolManager.execute('generatePuzzles', [100, options], async (newPuzzles: CreatePuzzle) => {
            const result = await this.createPuzzles([newPuzzles]);
            if(result != 1) {
              console.log("A puzzle failed to be created in the database")
            }
          })
          const response = await this.sudokuDataSource.getNewPuzzle(requestedBy, options);
          return response.puzzle;
        } else {
          throw err;
        }
      }
    });
  };
  async getPuzzles(options: PuzzleOptions, page?: number, limit?: number): Promise<PuzzleArray>{
    return await this.callDataSource(async () => {
      return await this.sudokuDataSource.getPuzzles(options, page, limit);
    })
  };
  async createPuzzles(puzzles: CreatePuzzle[]): Promise<number> {
    return await this.callDataSource(async () => {
      return await this.sudokuDataSource.createPuzzles(puzzles);
    })
  };
  async getUserPuzzle(userId: string, puzzleId: string): Promise<UserPuzzleDto> {
    return await this.callDataSource(async () => {
      const sqlUserPuzle = await this.sudokuDataSource.getUserPuzzle(userId, puzzleId);
      return {
        _id: sqlUserPuzle.puzzle_id,
        currentCells: sqlUserPuzle.current_cells,
        currentCandidates: sqlUserPuzle.current_candidates,
        originalCells: sqlUserPuzle.original_cells,
        time: sqlUserPuzle.time,
        isCompleted: sqlUserPuzle.is_completed,
        actions: sqlUserPuzle.actions,
        difficulty: {
          score: sqlUserPuzle.difficulty_score,
          rating: sqlUserPuzle.difficulty_rating
        }
      }
    })
  }
  async updateUserPuzzle(userId: string, puzzle: UpdatePuzzle): Promise<number> {
    return await this.callDataSource(async () => {  
      // don't trust that the puzzle is actually complete, verfiy
      if(puzzle.isCompleted) {
        const existingPuzzle = await this.sudokuDataSource.getPuzzleById(puzzle._id)
        puzzle.isCompleted = existingPuzzle.solved_cells === puzzle.cells
      }
      return await this.sudokuDataSource.updateUserPuzzle(userId, puzzle)
    });
  };
  async deletePuzzle(puzzleId: string): Promise<number>{
    return await this.callDataSource(async () => {
      return await this.sudokuDataSource.deletePuzzle(puzzleId)
    });
  }
}
