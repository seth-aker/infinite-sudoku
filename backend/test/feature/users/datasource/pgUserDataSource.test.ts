import { beforeEach, describe, expect, it } from "vitest";
import { DatabaseError } from "@/core/errors/databaseError";
import { ErrorType } from "@/core/errors/errorTypes";
import { NotFoundError } from "@/core/errors/notFoundError";
import { PgUserDataSource } from "@/feature/users/datasource/pgUserDataSource";
import { fakeSql } from "#test/helpers/sql";

const USER_ID = "3f0c7a4e-1b2d-4c5e-8f9a-0b1c2d3e4f5a";

describe("PgUserDataSource", () => {
  let db: ReturnType<typeof fakeSql>;
  let source: PgUserDataSource;

  beforeEach(() => {
    db = fakeSql();
    PgUserDataSource.instance = null;
    source = PgUserDataSource.create(db.sql);
  });

  it("returns the same instance on later create calls", () => {
    expect(PgUserDataSource.create(fakeSql().sql)).toBe(source);
  });

  describe("createUser", () => {
    const user = {
      email: "player@example.com",
      username: "player",
      passwordHash: "hash",
      salt: "salt",
      role: "user" as const,
      tosAcknowledged: true,
    };

    it("inserts the user's fields in correct order and returns the new id", async () => {
      db.returns([{ user_id: USER_ID }]);
      await expect(source.createUser(user)).resolves.toBe(USER_ID);
      expect(db.queries[0]!.values).toEqual([
        "player@example.com",
        "player",
        "hash",
        "salt",
        "user",
        true,
      ]);
    });

    it("throws a DatabaseError when no row comes back", async () => {
      db.returns([]);
      await expect(source.createUser(user)).rejects.toBeInstanceOf(DatabaseError);
    });
  });

  describe("getUser", () => {
    it("returns the user row", async () => {
      const row = { user_id: USER_ID, email: "player@example.com" };
      db.returns([row]);
      await expect(source.getUser(USER_ID)).resolves.toEqual(row);
      expect(db.queries[0]!.values).toEqual([USER_ID]);
    });

    it("sql query excludes deleted users and never selects the password hash or salt", async () => {
      db.returns([{ user_id: USER_ID }]);
      await source.getUser(USER_ID);
      const { text } = db.queries[0]!;
      expect(text).toMatch(/deleted_at IS NULL/);
      expect(text).not.toMatch(/password_hash|salt/);
    });

    it("throws a NotFoundError when there is no such user", async () => {
      db.returns([]);
      const err = await source.getUser(USER_ID).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.code).toBe(ErrorType.RESOURCE_NOT_FOUND);
    });
  });

  describe("getUserByEmail", () => {
    it("looks the email up in lowercase", async () => {
      await source.getUserByEmail("Player@Example.COM");
      expect(db.queries[0]!.values).toEqual(["player@example.com"]);
    });

    it("returns the row, and query requires the credentials verify() needs", async () => {
      const row = { user_id: USER_ID, password_hash: "hash", salt: "salt", deleted_at: null };
      db.returns([row]);
      await expect(source.getUserByEmail("player@example.com")).resolves.toEqual(row);
      expect(db.queries[0]!.text).toMatch(/password_hash/);
      expect(db.queries[0]!.text).toMatch(/deleted_at/);
    });
  });

  describe("getUserStats", () => {
    it("maps each difficulty row to camelCase stats", async () => {
      db.returns([
        { rating: "easy", avg_score: 12, total_started: 4, completed: 3, avg_time_sec: 300, total_time_sec: 1200 },
        { rating: "hard", avg_score: 40, total_started: 1, completed: 0, avg_time_sec: 900, total_time_sec: 900 },
      ]);
      await expect(source.getUserStats(USER_ID)).resolves.toEqual([
        { rating: "easy", avgScore: 12, totalStarted: 4, completed: 3, avgTimeSec: 300, totalTimeSec: 1200 },
        { rating: "hard", avgScore: 40, totalStarted: 1, completed: 0, avgTimeSec: 900, totalTimeSec: 900 },
      ]);
      expect(db.queries[0]!.values).toEqual([USER_ID]);
    });

    it("returns an empty list for a user with no puzzles", async () => {
      db.returns([]);
      await expect(source.getUserStats(USER_ID)).resolves.toEqual([]);
    });
  });

  describe("changePassword", () => {
    it("updates the hash and salt for the user", async () => {
      await source.changePassword(USER_ID, "new-hash", "new-salt");
      expect(db.queries[0]!.values).toEqual(["new-hash", "new-salt", USER_ID]);
    });
  });

  describe("deleteUser", () => {
    it("soft deletes the user and returns the number of rows updated", async () => {
      // An UPDATE without RETURNING has no rows; postgres.js reports the
      // affected row count in `count`.
      db.returns([], 1);
      await expect(source.deleteUser(USER_ID)).resolves.toBe(1);
      expect(db.queries[0]!.text).toMatch(/SET deleted_at = CURRENT_TIMESTAMP/);
      expect(db.queries[0]!.values).toEqual([USER_ID]);
    });

    it("throws when no user was updated", async () => {
      db.returns([], 0);
      await expect(source.deleteUser(USER_ID)).rejects.toBeInstanceOf(DatabaseError);
    });
  });
});
