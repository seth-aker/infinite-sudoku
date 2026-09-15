import { DatabaseError } from "@/core/errors/databaseError";
import { PuzzleOptions } from "./models/puzzleOptions";
import {
  CreatePuzzle,
  SqlPuzzle,
  SqlUserPuzzle,
  SudokuPuzzleResponse,
  UpdatePuzzle,
} from "./models/sudokuPuzzle";
import { SudokuDataSource } from "./sudokuDataSource";
import { Sql } from "postgres";
import { PuzzleArray } from "./models/puzzleArray";
import { CustomError } from "@/core/errors/customError";
import { NotFoundError } from "@/core/errors/notFoundError";
import { ErrorType } from "@/core/errors/errorTypes";
interface QueryRes extends SqlPuzzle {
  total_count: number;
}
export class PgSudokuDataSource implements SudokuDataSource {
  static instance: PgSudokuDataSource | null = null;
  private client: Sql;
  private constructor(client: Sql) {
    this.client = client;
  }
  static create(client: Sql) {
    if (!PgSudokuDataSource.instance) {
      PgSudokuDataSource.instance = new PgSudokuDataSource(client);
    }
    return PgSudokuDataSource.instance;
  }
  async getNewPuzzle(
    requestedBy: string | undefined,
    options: PuzzleOptions,
  ): Promise<SudokuPuzzleResponse> {
    const userId = requestedBy;

    const res = await this.client.begin(async (sql) => {
      const [puzzle] = await sql<(QueryRes | undefined)[]>`
          SELECT p.puzzle_id, p.cells, p.difficulty_score, p.difficulty_rating, p.created_at, COUNT(*) OVER () as total_count
          FROM puzzles p
          WHERE
            p.difficulty_rating = ${options.difficulty}
            -- inject the NOT EXISTS block only if userId exists
            ${
              userId
                ? this.client`
                AND NOT EXISTS (
                  SELECT 1
                  FROM user_puzzles up
                  WHERE
                    up.puzzle_id = p.puzzle_id
                    AND up.user_id = ${userId}
                )
              `
                : this.client``
            }
          ORDER BY RANDOM()
          LIMIT 1;
          `;

      if (userId && puzzle) {
        await sql`
              INSERT INTO user_puzzles (
                user_id,
                puzzle_id,
                cells
              )
              VALUES (
                ${userId},
                ${puzzle.puzzle_id},
                ${puzzle.cells}
              )
            `;
        await sql`
              UPDATE users 
              SET current_puzzle_id = ${puzzle.puzzle_id}
              WHERE user_id = ${userId}
            `;
      }
      return puzzle;
    });
    if (!res || res.total_count === 0) {
      throw new DatabaseError("No more puzzles");
    }
    const response: SudokuPuzzleResponse = {
      metadata: {
        totalCount: res.total_count,
      },
      puzzle: {
        puzzleId: res.puzzle_id,
        cells: res.cells,
        score: res.difficulty_score,
        rating: res.difficulty_rating,
      },
    };
    return response;
  }

  async getPuzzleById(puzzleId: string): Promise<SqlPuzzle> {
    const [res] = await this.client<(SqlPuzzle | undefined)[]>`
      SELECT * FROM puzzles WHERE puzzle_id = ${puzzleId};
      `;
    if (!res) {
      throw new NotFoundError(`Puzzle with id: ${puzzleId} not found`, {
        type: ErrorType.RESOURCE_NOT_FOUND,
      });
    }
    const puzzleRow = res;
    return puzzleRow;
  }

  async getPuzzles(
    options: PuzzleOptions,
    page?: number,
    limit: number = 100,
  ): Promise<PuzzleArray> {
    throw new DatabaseError("Not implemented");
  }

  async createPuzzles(puzzles: CreatePuzzle[]): Promise<number> {
    const queries = puzzles.map((puzzle) => {
      return this.client<({ puzzle_id: string } | undefined)[]>`
        INSERT INTO puzzles (
          cells,
          solved_cells,
          difficulty_score,
          difficulty_rating
        ) VALUES (
          ${puzzle.cells},
          ${puzzle.solvedCells},
          ${puzzle.score ?? null},
          ${puzzle.rating} 
        ) RETURNING puzzle_id;
      `;
    });

    const res = await Promise.all(queries);
    return res.length;
  }
  async updateUserPuzzle(
    userId: string,
    puzzle: UpdatePuzzle,
  ): Promise<number> {
    const res = await this.client.begin(async (sql) => {
      const updateUpRes = await sql`
        UPDATE user_puzzles
        SET cells = ${puzzle.cells},
          candidates = ${puzzle.candidates},
          is_completed = ${puzzle.isCompleted},
          time = ${puzzle.time},
          actions = ${puzzle.actions}
          ${puzzle.isCompleted ? this.client`, completed_at = CURRENT_TIMESTAMP ` : this.client``}
        WHERE user_id = ${userId} AND puzzle_id = ${puzzle.puzzleId}
      `;
      if (updateUpRes.count !== 1) {
        const insertRes = await sql`
          INSERT INTO user_puzzles (
            user_id,
            puzzle_id,
            cells,
            candidates,
            is_completed,
            time,
            actions
            ${puzzle.isCompleted ? this.client`, completed_at` : this.client``}
          )
          VALUES (
            ${userId},
            ${puzzle.puzzleId},
            ${puzzle.cells},
            ${puzzle.candidates},
            ${puzzle.isCompleted},
            ${puzzle.time},
            ${puzzle.actions}
            ${puzzle.isCompleted ? this.client`, CURRENT_TIMESTAMP` : this.client``}
          )
        `;
        if (insertRes.count !== 1) {
          return insertRes.count;
        }
      }
      if (puzzle.isCompleted) {
        const updateRes = await sql`
          UPDATE users SET current_puzzle_id = null WHERE user_id = ${userId}
        `;
        return updateRes.count;
      }
      const userRes = await sql`
        UPDATE users 
        SET current_puzzle_id = ${puzzle.puzzleId}
        WHERE user_id = ${userId}
      `;
      if (userRes.count !== 1) {
        return userRes.count;
      }
      return 1;
    });
    return res;
  }
  async getUserPuzzle(
    userId: string,
    puzzleId: string,
  ): Promise<SqlUserPuzzle> {
    const [res] = await this.client<(SqlUserPuzzle | undefined)[]>`
        SELECT 
          p.puzzle_id,
          up.is_completed,
          up.cells as current_cells,
          up.candidates as current_candidates,
          up.time,
          p.cells as original_cells,
          p.difficulty_rating,
          p.difficulty_score,
          up.actions
        FROM user_puzzles AS up
          JOIN puzzles AS p ON p.puzzle_id = up.puzzle_id
        WHERE 
          up.user_id = ${userId}
          AND up.puzzle_id = ${puzzleId}
      `;
    if (!res) {
      throw new NotFoundError(`No puzzle with id: ${puzzleId} found`, {
        type: ErrorType.RESOURCE_NOT_FOUND,
      });
    }
    return res;
  }
  async deletePuzzle(puzzleId: string): Promise<number> {
    throw new DatabaseError("Fn deletePuzzle() not implemented");
  }
}
