import { DatabaseError } from "@/core/errors/databaseError";
import { PuzzleOptions } from "./models/puzzleOptions";
import {
  CreatePuzzle,
  SqlPuzzle,
  SudokuPuzzleResponse,
  UserPuzzleDto,
} from "./models/sudokuPuzzle";
import { SudokuDataSource } from "./sudokuDataSource";
import { Sql } from "postgres";
import { PuzzleArray } from "./models/puzzleArray";
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
            ${userId
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
    puzzle: UserPuzzleDto,
  ): Promise<number> {
    const res = await this.client`
      UPDATE user_puzzles
      SET
        is_completed = ${puzzle.isCompleted},
        cells = ${puzzle.cells},
        candidates = ${puzzle.candidates},
        "time" = ${puzzle.time},
        actions = ${puzzle.actions}
      WHERE 
        user_id = ${userId} AND
        puzzle_id = ${puzzle.puzzleId} AND
        NOT is_completed
      `
    if(res.count < 1) {
      const insertRes = await this.client`
        INSERT INTO user_puzzles (
          user_id,
          puzzle_id,
          cells,
          candidates,
          "time",
          actions,
          is_completed
        )
        VALUES (
          ${userId},
          ${puzzle.puzzleId},
          ${puzzle.cells},
          ${puzzle.candidates},
          ${puzzle.time},
          ${puzzle.actions},
          ${puzzle.isCompleted}
        );`
      return insertRes.count;
    }
    return res.count;
    // if (puzzle.startedAt == null) {
    //   const res = await this.client`
    //       UPDATE user_puzzles
    //       SET
    //         is_completed = ${puzzle.isCompleted},
    //         cells = ${puzzle.cells},
    //         candidates = ${puzzle.candidates},
    //         "time" = FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)))::int,
    //         started_at = NULL,
    //         actions = ${puzzle.actions}
    //       WHERE
    //         user_id = ${userId} AND
    //         puzzle_id = ${puzzle.puzzleId} AND
    //         started_at IS NOT NULL AND
    //         NOT is_completed;
    //     `
    //   return res.count;
    // } else {
    //   // puzzle resumed
    //   const res = await this.client`
    //     UPDATE user_puzzles
    //     SET
    //       is_completed = ${puzzle.isCompleted},
    //       cells = ${puzzle.cells},
    //       candidates = ${puzzle.candidates},
    //       -- if started_at is already not null, don't update it.
    //       started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
    //       actions = ${puzzle.actions}
    //     WHERE
    //       user_id = ${userId} AND
    //       puzzle_id = ${puzzle.puzzleId}
    //   `
    //   return res.count;
    // }
  }
  async getUserPuzzle(
    userId: string,
    puzzleId: string,
  ): Promise<UserPuzzleDto> {
    const [res] = await this.client<(UserPuzzleDto | undefined)[]>`
        SELECT 
          p.puzzle_id as puzzleId,
          up.is_completed as isCompleted,
          up.cells,
          up.candidates,
          up.time,
          p.cells as originalCells,
          p.difficulty_rating as rating,
          p.difficulty_score as score,
          up.actions,
          up.started_at as startedAt
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
