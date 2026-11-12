import { createHash, randomBytes } from "node:crypto";
import type { Sql } from "postgres";

// Inserts rows directly with SQL, so a datasource's tests depend only on the
// schema and the datasource under test, never on another datasource's code.
// Each helper fills in valid defaults; pass overrides (column names as in
// db/schema.sql) for the fields a test cares about.

let seq = 0;
const next = () => ++seq;

export const CELLS = "0".repeat(81);
export const SOLVED_CELLS = "1".repeat(81);
export const EMPTY_CANDIDATES = Array(81).fill("").join(":");

export interface UserRow {
  user_id: string;
  email: string;
  email_verified: boolean;
  username: string;
  password_hash: string;
  salt: string;
  role: "user" | "admin";
  image_url: string | null;
  current_puzzle_id: string | null;
  tos_acknowledged: boolean;
  deleted_at: Date | null;
}

export interface PuzzleRow {
  puzzle_id: string;
  cells: string;
  solved_cells: string;
  difficulty_score: number | null;
  difficulty_rating: string;
  created_at: Date;
}

export interface UserPuzzleRow {
  user_id: string;
  puzzle_id: string;
  is_completed: boolean;
  cells: string;
  candidates: string | null;
  time: number;
  actions: number[] | null;
}

/** Inserts a user with a unique email and username; returns its user_id. */
export async function insertUser(sql: Sql, overrides: Partial<UserRow> = {}) {
  const n = next();
  const row = {
    email: `user${n}@test.co`,
    username: `user${n}`,
    password_hash: "hash",
    salt: "salt",
    ...overrides,
  };
  const [inserted] = await sql<{ user_id: string }[]>`
    INSERT INTO users ${sql(row)} RETURNING user_id
  `;
  return inserted!.user_id;
}

/** Inserts an easy puzzle; returns its puzzle_id. */
export async function insertPuzzle(sql: Sql, overrides: Partial<PuzzleRow> = {}) {
  const row = {
    cells: CELLS,
    solved_cells: SOLVED_CELLS,
    difficulty_score: 10,
    difficulty_rating: "easy",
    ...overrides,
  };
  const [inserted] = await sql<{ puzzle_id: string }[]>`
    INSERT INTO puzzles ${sql(row)} RETURNING puzzle_id
  `;
  return inserted!.puzzle_id;
}

/** Records that a user has started a puzzle, with no progress yet by default. */
export async function insertUserPuzzle(
  sql: Sql,
  ids: { user_id: string; puzzle_id: string },
  overrides: Partial<Omit<UserPuzzleRow, "user_id" | "puzzle_id">> = {},
) {
  const row = {
    cells: CELLS,
    candidates: EMPTY_CANDIDATES,
    time: 0,
    actions: [] as number[],
    ...ids,
    ...overrides,
  };
  await sql`INSERT INTO user_puzzles ${sql(row)}`;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Stores a refresh token the way PgRefreshTokenDataSource does (only its
 * sha256 hash) and returns the raw token a client would hold.
 */
export async function insertRefreshToken(
  sql: Sql,
  ids: { user_id: string },
  overrides: { token?: string; expires_at?: Date } = {},
) {
  const token = overrides.token ?? randomBytes(40).toString("hex");
  const expires_at = overrides.expires_at ?? new Date(Date.now() + THIRTY_DAYS_MS);
  const hashed = createHash("sha256").update(token).digest("hex");
  await sql`INSERT INTO refresh_tokens ${sql({ user_id: ids.user_id, token: hashed, expires_at })}`;
  return token;
}

/** Inserts an unused reset token; returns the token. */
export async function insertResetToken(
  sql: Sql,
  ids: { user_id: string },
  overrides: { status?: "UNUSED" | "USED"; created_at?: Date } = {},
) {
  const [row] = await sql<{ reset_token: string }[]>`
    INSERT INTO reset_tokens ${sql({ ...ids, ...overrides })} RETURNING reset_token
  `;
  return row!.reset_token;
}

/** Inserts an email validation token; returns the token. */
export async function insertValidateToken(
  sql: Sql,
  ids: { user_id: string },
  overrides: { created_at?: Date } = {},
) {
  const [row] = await sql<{ token: string }[]>`
    INSERT INTO validate_tokens ${sql({ ...ids, ...overrides })} RETURNING token
  `;
  return row!.token;
}
