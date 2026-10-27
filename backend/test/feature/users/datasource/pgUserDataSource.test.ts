import { beforeEach, describe, expect, it } from "vitest";
import { PgUserDataSource } from "@/feature/users/datasource/pgUserDataSource";
import { NotFoundError } from "@/core/errors/notFoundError";
import { DatabaseError } from "@/core/errors/databaseError";
import { ErrorType } from "@/core/errors/errorTypes";
import { createSqlMock, result, type SqlMock } from "#test/helpers/sql";
import { buildSqlUser, USER_ID } from "#test/helpers/fixtures";

describe("PgUserDataSource", () => {
  let db: SqlMock;
  let source: PgUserDataSource;

  beforeEach(() => {
    PgUserDataSource.instance = null;
    db = createSqlMock();
    source = PgUserDataSource.create(db.sql);
  });

  it("is a singleton", () => {
    expect(PgUserDataSource.create(createSqlMock().sql)).toBe(source);
  });

  describe("createUser", () => {
    const user = {
      email: "a@b.c",
      username: "abcd",
      passwordHash: "hash",
      salt: "salt",
      role: "user" as const,
      tosAcknowledged: true,
    };

    it("inserts the user and returns the new id", async () => {
      db.enqueue(result([{ user_id: USER_ID }]));
      await expect(source.createUser(user)).resolves.toBe(USER_ID);
      expect(db.calls[0].query).toContain("INSERT INTO users");
      expect(db.calls[0].values).toEqual([
        "a@b.c",
        "abcd",
        "hash",
        "salt",
        "user",
        true,
      ]);
    });

    it("throws a TypeError when no row is returned", async () => {
      db.enqueue(result([]));
      await expect(source.createUser(user)).rejects.toThrow(TypeError);
    });

    it("propagates database errors", async () => {
      db.enqueue(new Error("unique violation"));
      await expect(source.createUser(user)).rejects.toThrow("unique violation");
    });
  });

  describe("getUser", () => {
    it("returns the active user", async () => {
      const user = buildSqlUser();
      db.enqueue(result([user]));
      await expect(source.getUser(USER_ID)).resolves.toBe(user);
      expect(db.calls[0].query).toContain("u.deleted_at IS NULL");
      expect(db.calls[0].query).not.toContain("password_hash");
      expect(db.calls[0].values).toEqual([USER_ID]);
    });

    it("throws NotFoundError when missing or deleted", async () => {
      db.enqueue(result([]));
      const err = await source.getUser(USER_ID).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.code).toBe(ErrorType.RESOURCE_NOT_FOUND);
      expect(err.message).toBe(`User with id: ${USER_ID} not found`);
    });
  });

  describe("getUserByEmail", () => {
    it("looks up the lowercased email including credentials", async () => {
      const user = buildSqlUser({ salt: "s", password_hash: "h" });
      db.enqueue(result([user]));
      await expect(source.getUserByEmail("User@Example.COM")).resolves.toBe(
        user,
      );
      expect(db.calls[0].values).toEqual(["user@example.com"]);
      expect(db.calls[0].query).toContain("password_hash");
      expect(db.calls[0].query).toContain("deleted_at");
    });

    it("throws NotFoundError without leaking the email", async () => {
      db.enqueue(result([]));
      const err = await source.getUserByEmail("x@y.z").catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.message).toBe("User email not found");
    });
  });

  describe("getUserStats", () => {
    it("maps rows to camelCase stats", async () => {
      db.enqueue(
        result([
          {
            rating: "easy",
            avg_score: 10,
            total_started: 5,
            completed: 3,
            avg_time_sec: 100,
            total_time_sec: 500,
          },
          {
            rating: "hard",
            avg_score: 50,
            total_started: 1,
            completed: 0,
            avg_time_sec: null,
            total_time_sec: null,
          },
        ]),
      );
      await expect(source.getUserStats(USER_ID)).resolves.toEqual([
        {
          rating: "easy",
          avgScore: 10,
          totalStarted: 5,
          completed: 3,
          avgTimeSec: 100,
          totalTimeSec: 500,
        },
        {
          rating: "hard",
          avgScore: 50,
          totalStarted: 1,
          completed: 0,
          avgTimeSec: null,
          totalTimeSec: null,
        },
      ]);
      expect(db.calls[0].query).toContain("GROUP BY p.difficulty_rating");
      expect(db.calls[0].values).toEqual([USER_ID]);
    });

    it("returns an empty array when the user has no puzzles", async () => {
      db.enqueue(result([]));
      await expect(source.getUserStats(USER_ID)).resolves.toEqual([]);
    });
  });

  describe("changePassword", () => {
    it("updates the hash and salt", async () => {
      await expect(
        source.changePassword(USER_ID, "new-hash", "new-salt"),
      ).resolves.toBeUndefined();
      expect(db.calls[0].query).toContain("UPDATE users");
      expect(db.calls[0].values).toEqual(["new-hash", "new-salt", USER_ID]);
    });
  });

  describe("deleteUser", () => {
    it("soft deletes and returns the number of returned rows", async () => {
      db.enqueue(result([{ user_id: USER_ID }], 1));
      await expect(source.deleteUser(USER_ID)).resolves.toBe(1);
      expect(db.calls[0].query).toContain("SET deleted_at = CURRENT_TIMESTAMP");
      expect(db.calls[0].values).toEqual([USER_ID]);
    });

    it("throws when the update returns no rows, even if a row was affected", async () => {
      db.enqueue(result([], 1));
      const err = await source.deleteUser(USER_ID).catch((e) => e);
      expect(err).toBeInstanceOf(DatabaseError);
      expect(err.message).toBe("Failed to delete user");
    });
  });
});
