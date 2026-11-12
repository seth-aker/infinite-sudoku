import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import postgres, { type Sql } from "postgres";
import { DatabaseError } from "@/core/errors/databaseError";
import { ErrorType } from "@/core/errors/errorTypes";
import { NotFoundError } from "@/core/errors/notFoundError";
import { PgUserDataSource } from "@/feature/users/datasource/pgUserDataSource";
import type { ICreateUser } from "@/feature/users/datasource/models/user";
import { connect, resetDb } from "#test/integration/helpers/db";
import { insertPuzzle, insertUser, insertUserPuzzle } from "#test/integration/helpers/fixtures";

describe("PgUserDataSource", () => {
  let sql: Sql;
  let users: PgUserDataSource;

  beforeAll(() => {
    sql = connect();
    // The datasource is a singleton; drop any instance bound to another client.
    PgUserDataSource.instance = null;
    users = PgUserDataSource.create(sql);
  });

  beforeEach(() => resetDb(sql));

  afterAll(() => sql.end());

  const rowOf = async (userId: string) => {
    const [row] = await sql`SELECT * FROM users WHERE user_id = ${userId}`;
    return row!;
  };

  describe("createUser", () => {
    const newUser = (overrides: Partial<ICreateUser> = {}): ICreateUser => ({
      email: "player@example.com",
      username: "player",
      passwordHash: "hash",
      salt: "salt",
      role: "user",
      tosAcknowledged: true,
      ...overrides,
    });

    it("stores each field in its own column and returns the new id", async () => {
      const userId = await users.createUser(newUser());
      expect(await rowOf(userId)).toMatchObject({
        user_id: userId,
        email: "player@example.com",
        username: "player",
        password_hash: "hash",
        salt: "salt",
        role: "user",
        tos_acknowledged: true,
      });
    });

    it("starts the user unverified, not deleted and without a current puzzle", async () => {
      const userId = await users.createUser(newUser());
      expect(await rowOf(userId)).toMatchObject({
        email_verified: false,
        deleted_at: null,
        current_puzzle_id: null,
      });
    });

    it.each([
      ["email", { username: "someone-else" }, "users_email_key"],
      ["email that differs only in case", { email: "PLAYER@Example.com", username: "someone-else" }, "users_email_key"],
      ["username", { email: "other@example.com" }, "users_username"],
      ["username that differs only in case", { email: "other@example.com", username: "PLAYER" }, "users_username"],
    ])("rejects a duplicate %s", async (_label, overrides, constraint) => {
      await users.createUser(newUser());
      const err = await users.createUser(newUser(overrides)).catch((e) => e);
      // errorHandler turns a unique violation into a 409.
      expect(err).toBeInstanceOf(postgres.PostgresError);
      expect(err).toMatchObject({ code: "23505", constraint_name: constraint });
    });

    it("keeps the email and username in the case they were given", async () => {
      const userId = await users.createUser(newUser({ email: "Player@Example.com", username: "PlayerOne" }));
      expect(await rowOf(userId)).toMatchObject({ email: "Player@Example.com", username: "PlayerOne" });
    });

    it("rejects an unknown role", async () => {
      await expect(
        users.createUser(newUser({ role: "superuser" as ICreateUser["role"] })),
      ).rejects.toMatchObject({ code: "23514" });
    });
  });

  describe("getUser", () => {
    it("returns the user's profile", async () => {
      const userId = await insertUser(sql, {
        email: "player@example.com",
        username: "player",
        email_verified: true,
        role: "admin",
        image_url: "http://img.test/a.png",
      });
      await expect(users.getUser(userId)).resolves.toMatchObject({
        user_id: userId,
        email: "player@example.com",
        username: "player",
        email_verified: true,
        role: "admin",
        image_url: "http://img.test/a.png",
        current_puzzle_id: null,
      });
    });

    it("never returns the password hash or salt", async () => {
      const userId = await insertUser(sql);
      const user = await users.getUser(userId);
      expect(user).not.toHaveProperty("password_hash");
      expect(user).not.toHaveProperty("salt");
    });

    it("treats a deleted user as not found", async () => {
      const userId = await insertUser(sql, { deleted_at: new Date() });
      await expect(users.getUser(userId)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws a NotFoundError for an unknown user", async () => {
      const err = await users.getUser(crypto.randomUUID()).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.code).toBe(ErrorType.RESOURCE_NOT_FOUND);
    });
  });

  describe("getUserByEmail", () => {
    it("returns the credentials verify() needs", async () => {
      const userId = await insertUser(sql, {
        email: "player@example.com",
        password_hash: "stored-hash",
        salt: "stored-salt",
        email_verified: true,
      });
      await expect(users.getUserByEmail("player@example.com")).resolves.toMatchObject({
        user_id: userId,
        password_hash: "stored-hash",
        salt: "stored-salt",
        email_verified: true,
        deleted_at: null,
      });
    });

    it.each([
      ["lowercase", "player@example.com"],
      ["the stored case", "Player@Example.com"],
      ["mixed case", "pLAYER@eXAMPLE.cOM"],
    ])("finds a mixed-case email when given %s", async (_label, lookup) => {
      const userId = await insertUser(sql, { email: "Player@Example.com" });
      await expect(users.getUserByEmail(lookup)).resolves.toMatchObject({
        user_id: userId,
        email: "Player@Example.com",
      });
    });

    it("still returns a deleted user, with deleted_at set, so verify() can reject it", async () => {
      await insertUser(sql, { email: "gone@example.com", deleted_at: new Date() });
      const user = await users.getUserByEmail("gone@example.com");
      expect(user?.deleted_at).toBeInstanceOf(Date);
    });

    it("returns undefined for an unknown email", async () => {
      await insertUser(sql, { email: "player@example.com" });
      await expect(users.getUserByEmail("nobody@example.com")).resolves.toBeUndefined();
    });
  });

  describe("getUserStats", () => {
    const byRating = <T extends { rating: string }>(stats: T[]) =>
      [...stats].sort((a, b) => a.rating.localeCompare(b.rating));

    it("summarises the user's puzzles per difficulty", async () => {
      const userId = await insertUser(sql);
      const easy1 = await insertPuzzle(sql, { difficulty_rating: "easy", difficulty_score: 10 });
      const easy2 = await insertPuzzle(sql, { difficulty_rating: "easy", difficulty_score: 21 });
      const hard = await insertPuzzle(sql, { difficulty_rating: "hard", difficulty_score: 50 });
      await insertUserPuzzle(sql, { user_id: userId, puzzle_id: easy1 }, { is_completed: true, time: 100 });
      await insertUserPuzzle(sql, { user_id: userId, puzzle_id: easy2 }, { is_completed: false, time: 51 });
      await insertUserPuzzle(sql, { user_id: userId, puzzle_id: hard }, { is_completed: true, time: 300 });

      expect(byRating(await users.getUserStats(userId))).toEqual([
        { rating: "easy", avgScore: 15.5, totalStarted: 2, completed: 1, avgTimeSec: 75.5, totalTimeSec: 151 },
        { rating: "hard", avgScore: 50, totalStarted: 1, completed: 1, avgTimeSec: 300, totalTimeSec: 300 },
      ]);
    });

    it("only counts the user's own puzzles", async () => {
      const userId = await insertUser(sql);
      const otherId = await insertUser(sql);
      const mine = await insertPuzzle(sql);
      const theirs = await insertPuzzle(sql);
      await insertUserPuzzle(sql, { user_id: userId, puzzle_id: mine }, { time: 10 });
      await insertUserPuzzle(sql, { user_id: otherId, puzzle_id: mine }, { time: 99 });
      await insertUserPuzzle(sql, { user_id: otherId, puzzle_id: theirs }, { time: 99 });

      expect(await users.getUserStats(userId)).toEqual([
        expect.objectContaining({ rating: "easy", totalStarted: 1, totalTimeSec: 10 }),
      ]);
    });

    it("returns an empty list for a user with no puzzles", async () => {
      const userId = await insertUser(sql);
      await expect(users.getUserStats(userId)).resolves.toEqual([]);
    });
  });

  describe("changePassword", () => {
    it("replaces the hash and salt", async () => {
      const userId = await insertUser(sql, { password_hash: "old-hash", salt: "old-salt" });
      await users.changePassword(userId, "new-hash", "new-salt");
      expect(await rowOf(userId)).toMatchObject({ password_hash: "new-hash", salt: "new-salt" });
    });

    it("only changes the given user", async () => {
      const userId = await insertUser(sql);
      const otherId = await insertUser(sql, { password_hash: "other-hash", salt: "other-salt" });
      await users.changePassword(userId, "new-hash", "new-salt");
      expect(await rowOf(otherId)).toMatchObject({ password_hash: "other-hash", salt: "other-salt" });
    });

    it("bumps updated_at", async () => {
      const userId = await insertUser(sql);
      const before = (await rowOf(userId)).updated_at as Date;
      await users.changePassword(userId, "new-hash", "new-salt");
      const after = (await rowOf(userId)).updated_at as Date;
      expect(after.getTime()).toBeGreaterThan(before.getTime());
    });
  });

  describe("deleteUser", () => {
    it("soft deletes the user and returns 1", async () => {
      const userId = await insertUser(sql);
      await expect(users.deleteUser(userId)).resolves.toBe(1);
      expect((await rowOf(userId)).deleted_at).toBeInstanceOf(Date);
    });

    it("hides the user from getUser afterwards", async () => {
      const userId = await insertUser(sql);
      await users.deleteUser(userId);
      await expect(users.getUser(userId)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("keeps the user's puzzle history", async () => {
      const userId = await insertUser(sql);
      const puzzleId = await insertPuzzle(sql);
      await insertUserPuzzle(sql, { user_id: userId, puzzle_id: puzzleId });
      await users.deleteUser(userId);
      expect(await sql`SELECT 1 FROM user_puzzles WHERE user_id = ${userId}`).toHaveLength(1);
    });

    it("throws a DatabaseError for an unknown user", async () => {
      await expect(users.deleteUser(crypto.randomUUID())).rejects.toBeInstanceOf(DatabaseError);
    });
  });
});
