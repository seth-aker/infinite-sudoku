import { SudokuDataSource } from "../datasource/sudokuDataSource";
import { PuzzleArray } from "../datasource/models/puzzleArray";
import { type PuzzleOptions} from "../datasource/models/puzzleOptions";
import { SudokuPuzzle, CreatePuzzle, UpdatePuzzle } from "../datasource/models/sudokuPuzzle";
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

  async getNewPuzzle(requestedBy: string, options: PuzzleOptions): Promise<SudokuPuzzle>{
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
        console.log(err)
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
  async getPuzzleById(requestedBy: string, puzzleId: string): Promise<SudokuPuzzle> {
    return await this.callDataSource(async () => {
      return await this.sudokuDataSource.getPuzzleById(requestedBy, puzzleId);
    })
  }

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
  async updatePuzzle(puzzle: UpdatePuzzle): Promise<number> {
    return await this.callDataSource(async () => {  
      return await this.sudokuDataSource.updatePuzzle(puzzle)
    });
  };
  async deletePuzzle(puzzleId: string): Promise<number>{
    return await this.callDataSource(async () => {
      return await this.sudokuDataSource.deletePuzzle(puzzleId)
    });
  }
}
