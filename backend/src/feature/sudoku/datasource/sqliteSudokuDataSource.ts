import { PuzzleArray } from "./models/puzzleArray";
import { PuzzleOptions } from "./models/puzzleOptions";
import { SudokuPuzzleResponse, SudokuPuzzle, CreatePuzzle, UpdatePuzzle } from "./models/sudokuPuzzle";
import { SudokuDataSource } from "./sudokuDataSource";
import type { Database, Statement } from "better-sqlite3";
import { DatabaseError } from "@/core/errors/databaseError";
import { puzzleScripts, userPuzzleScripts } from "@/core/dataSource/sqlite3";
import {  DifficultyRating } from "./models/difficulty";
import { CandidateSet } from "./models/candidateSet";

interface SqlScripts {
  createPuzzle: Statement<{cells: string, difficultyScore: number, difficultyRating: string}>
  getUserPuzzle: Statement<{userId: string, puzzleId: string}, SqlUserPuzzle>,
  getPuzzleById: Statement<{puzzleId: string}, SqlPuzzle>,
  getPuzzleByDifficulty: Statement<{difficultyRating: string, userId: string | null}, SqlPuzzle & {total_count: number}>,
  updatePuzzle: Statement<{isCompleted: boolean, cells: string, candidates: string, time: string, userId: string, puzzleId: string}>,
  createUserPuzzle: Statement<{userId: string, puzzleId: string, isCompleted: boolean, cells: string, candidates: string}>
}

interface SqlPuzzle {
  puzzle_id: string,
  cells: string,
  difficulty_rating: string,
  difficulty_score: number
}
interface SqlUserPuzzle {
  puzzle_id: string,
  isCompleted: number,
  current_cells: string,
  current_candidates: string,
  time: string,
  original_cells: string,
  difficulty_rating: string,
  difficulty_score: string
}


export class SqliteSudokuDataSource implements SudokuDataSource {
  static instance: SqliteSudokuDataSource | null = null;
  private db: Database | null = null;
  private scripts: SqlScripts;
  private constructor(db: Database) {
    this.db = db;
    this.scripts = this.prepareScripts() as SqlScripts;
  }
  static create(db: Database) {
    if(SqliteSudokuDataSource.instance === null) {
      SqliteSudokuDataSource.instance = new SqliteSudokuDataSource(db);
    }
    return SqliteSudokuDataSource.instance;
  }

  async getNewPuzzle(requestedBy: string | undefined, options: PuzzleOptions): Promise<SudokuPuzzleResponse> {
      const result = this.scripts.getPuzzleByDifficulty.get({difficultyRating: options.difficulty, userId: requestedBy ?? null});
      if(!result || result.total_count === 0) {
        throw new DatabaseError("No more puzzles")
      }
      if(requestedBy) {
        this.scripts.createUserPuzzle.run({
          userId: requestedBy,
          puzzleId: result.puzzle_id,
          isCompleted: false,
          cells: result.cells,
          candidates: ""
        })
      }
      const cells = this.deserializeCells(result.cells);
      const response: SudokuPuzzleResponse = {
         metadata: {
          totalCount: result.total_count
         },
         puzzle: {
          _id: result.puzzle_id,
          cells: cells,
          difficulty: {
            rating: result.difficulty_rating as DifficultyRating,
            score: result.difficulty_score
          }
         }
      }
      return response;
    
  }
  async getPuzzleById(requestedBy: string, puzzleId: string): Promise<SudokuPuzzle> {
    try {
      const result = this.scripts.getPuzzleById.get({
        puzzleId: puzzleId
      })
      if(!result) {
        throw new DatabaseError(`Could not find puzzle with id: ${puzzleId}`)
      }
      const cells = this.deserializeCells(result.cells);
      return {
        _id: result.puzzle_id,
        cells,
        difficulty: {
          rating: result.difficulty_rating as DifficultyRating,
          score: result.difficulty_score
        }
      }
    } catch (err) {
      throw new DatabaseError(err as string);
    }
  }
  async getPuzzles(options: PuzzleOptions, page?: number, limit?: number): Promise<PuzzleArray> {
    throw new DatabaseError("Fn getPuzzles() not implemented")
  }
  async createPuzzles(puzzles: CreatePuzzle[]): Promise<number> {
    puzzles.forEach((puzzle) => {
      try {
        this.scripts.createPuzzle.all({
          cells: puzzle.cells, 
          difficultyScore: puzzle.difficulty.score ?? 0, 
          difficultyRating: puzzle.difficulty.rating
        })
      } catch (err) {
        throw new DatabaseError((err as Error).message);
      }
    })
    return puzzles.length;
  }
  async updatePuzzle(puzzle: UpdatePuzzle): Promise<number> {
    throw new DatabaseError("Fn updatePuzzle() not implemented")
  }
  async deletePuzzle(puzzleId: string): Promise<number> {
    throw new DatabaseError("Fn deletePuzzle() not implemented")
  }

  private deserializeCells(cellString: string) {
    const cells: number[] = cellString.split("").map(val => {
      const num = Number.parseInt(val)
      if(Number.isNaN(num)) {
        return -1;
      }
      return num;
    })
    return cells
  }
  private deserializeCandidates(candidatesString: string) {
    const raw = candidatesString.split(';')
    if(raw.length != 81) {
      throw new DatabaseError('Candidate Deserialization error: length not 81 cells')
    }
    const candidates = raw.map((candidateString) => {
      const candidates = candidateString.split('').map(each => {
        const num = Number.parseInt(each)
        if(Number.isNaN(num)) {
          return -1;
        }
        return num;
      });
      return new CandidateSet(candidates);
    })
    return candidates
  }
  private prepareScripts() {
    if(!this.db) {
      throw new DatabaseError("Error: db instance is NULL")
    }
    const scripts = {
      createPuzzle: this.db.prepare(puzzleScripts.createPuzzle),
      getPuzzleById: this.db.prepare(puzzleScripts.getPuzzleById),
      createUserPuzzle: this.db.prepare(userPuzzleScripts.insertUserPuzzle),
      getUserPuzzle: this.db.prepare(userPuzzleScripts.getUserPuzzle),
      getPuzzleByDifficulty: this.db.prepare(puzzleScripts.getPuzzleByDifficulty),
      updatePuzzle: this.db.prepare(userPuzzleScripts.updateUserPuzzle)
    }
    return scripts
  }
}
