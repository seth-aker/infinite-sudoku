import type { ISqlUser } from "@/feature/users/datasource/models/user";
import type {
  SqlPuzzle,
  UserPuzzleDto,
} from "@/feature/sudoku/datasource/models/sudokuPuzzle";

export const USER_ID = "11111111-1111-4111-8111-111111111111";
export const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
export const PUZZLE_ID = "33333333-3333-4333-8333-333333333333";
export const RESET_TOKEN = "44444444-4444-4444-8444-444444444444";

export const VALID_PASSWORD = "Str0ng!Pass";

export const CELLS = "0".repeat(81);
export const SOLVED_CELLS = "1".repeat(81);
export const EMPTY_CANDIDATES = ":".repeat(80);

export function buildSqlUser(overrides: Partial<ISqlUser> = {}): ISqlUser {
  return {
    user_id: USER_ID,
    email: "user@example.com",
    email_verified: true,
    username: "player",
    role: "user",
    image_url: "http://img.test/a.png",
    current_puzzle_id: PUZZLE_ID,
    last_login_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

export function buildSqlPuzzle(overrides: Partial<SqlPuzzle> = {}): SqlPuzzle {
  return {
    puzzle_id: PUZZLE_ID,
    cells: CELLS,
    difficulty_rating: "easy",
    difficulty_score: 42,
    solved_cells: SOLVED_CELLS,
    ...overrides,
  };
}

export function buildUserPuzzle(
  overrides: Partial<UserPuzzleDto> = {},
): UserPuzzleDto {
  return {
    puzzleId: PUZZLE_ID,
    isCompleted: false,
    cells: CELLS,
    candidates: EMPTY_CANDIDATES,
    time: 10,
    actions: [1, 2, 3],
    ...overrides,
  };
}
