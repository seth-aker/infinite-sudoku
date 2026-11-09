import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { ErrorType } from "@/core/errors/errorTypes";
import { logger } from "@/core/logging/logger";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";
import { PgRefreshTokenDataSource } from "@/feature/auth/datasource/pgRefreshTokenDataSource";
import { fakeSql } from "#test/helpers/sql";

const USER_ID = "3f0c7a4e-1b2d-4c5e-8f9a-0b1c2d3e4f5a";
const NOW = new Date("2026-06-01T12:00:00Z");
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

describe("PgRefreshTokenDataSource", () => {
  let db: ReturnType<typeof fakeSql>;
  let source: PgRefreshTokenDataSource;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    db = fakeSql();
    PgRefreshTokenDataSource.instance = null;
    source = PgRefreshTokenDataSource.create(db.sql);
  });

  afterEach(() => {
    source.close();
    vi.useRealTimers();
  });

  it("returns the same instance on later static create calls", () => {
    expect(PgRefreshTokenDataSource.create(fakeSql().sql)).toBe(source);
  });

  describe("create", () => {
    it("returns a random 80 character hex token", async () => {
      const first = await source.create(USER_ID);
      const second = await source.create(USER_ID);
      expect(first).toMatch(/^[0-9a-f]{80}$/);
      expect(second).not.toBe(first);
    });

    it("stores only the sha256 hash of the token", async () => {
      const token = await source.create(USER_ID);
      const [userId, stored] = db.queries[0]!.values;
      expect(userId).toBe(USER_ID);
      expect(stored).toBe(sha256(token));
      expect(db.queries[0]!.values).not.toContain(token);
    });

    it("expires the token in 30 days, in whole seconds for to_timestamp", async () => {
      await source.create(USER_ID);
      const expiresAt = db.queries[0]!.values[2];
      expect(expiresAt).toBe(Math.ceil((NOW.getTime() + THIRTY_DAYS_MS) / 1000));
    });
  });

  describe("rotateRefreshToken", () => {
    const future = () => new Date(NOW.getTime() + 60_000);

    it("consumes the old token and stores a new one for the same user in a transaction", async () => {
      db.returns([{ user_id: USER_ID, expires_at: future() }]);
      const result = await source.rotateRefreshToken("old-token");

      expect(db.tag.begin).toHaveBeenCalledOnce();
      expect(db.queries).toHaveLength(2);
      expect(db.queries[0]!.values).toEqual([sha256("old-token")]);

      expect(result.userId).toBe(USER_ID);
      expect(result.token).toMatch(/^[0-9a-f]{80}$/);
      expect(result.token).not.toBe("old-token");
      const [userId, stored, expiresAt] = db.queries[1]!.values;
      expect(userId).toBe(USER_ID);
      expect(stored).toBe(sha256(result.token));
      expect(expiresAt).toBe(Math.ceil((NOW.getTime() + THIRTY_DAYS_MS) / 1000));
    });

    it("never sends the raw old or new token to the database", async () => {
      db.returns([{ user_id: USER_ID, expires_at: future() }]);
      const { token } = await source.rotateRefreshToken("old-token");
      const allValues = db.queries.flatMap((q) => q.values);
      expect(allValues).not.toContain("old-token");
      expect(allValues).not.toContain(token);
    });

    it("rejects an unknown token as TOKEN_INVALID without inserting", async () => {
      db.returns([]);
      const err = await source.rotateRefreshToken("old-token").catch((e) => e);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.code).toBe(ErrorType.TOKEN_INVALID);
      expect(db.queries).toHaveLength(1);
    });

    it("rejects an expired token as TOKEN_EXPIRED without inserting", async () => {
      db.returns([{ user_id: USER_ID, expires_at: new Date(NOW.getTime() - 1) }]);
      const err = await source.rotateRefreshToken("old-token").catch((e) => e);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.code).toBe(ErrorType.TOKEN_EXPIRED);
      expect(db.queries).toHaveLength(1);
    });

    it("propagates database errors", async () => {
      const dbErr = new Error("connection lost");
      db.returns([{ user_id: USER_ID, expires_at: future() }]).fails(dbErr);
      await expect(source.rotateRefreshToken("old-token")).rejects.toBe(dbErr);
    });
  });

  describe("delete", () => {
    it("deletes by the token's hash", async () => {
      await source.delete("some-token");
      expect(db.queries[0]!.values).toEqual([sha256("some-token")]);
    });
  });

  describe("invalidateAllForUser", () => {
    it("deletes by user id", async () => {
      await source.invalidateAllForUser(USER_ID);
      expect(db.queries[0]!.values).toEqual([USER_ID]);
    });
  });

  describe("expired token sweep", () => {
    it("deletes expired tokens every 15 minutes", async () => {
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES_MS - 1);
      expect(db.queries).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(db.queries).toHaveLength(1);
      expect(db.queries[0]!.text).toMatch(/DELETE FROM refresh_tokens WHERE expires_at < now\(\)/);
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES_MS);
      expect(db.queries).toHaveLength(2);
    });

    it("logs and keeps running when a sweep fails", async () => {
      const err = new Error("db down");
      db.fails(err);
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES_MS);
      expect(logger.error).toHaveBeenCalledWith({ err }, "refresh token sweep failed");
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES_MS);
      expect(db.queries).toHaveLength(2);
    });

    it("stops after close()", async () => {
      source.close();
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES_MS * 2);
      expect(db.queries).toHaveLength(0);
    });

    it("does not keep the process alive", () => {
      // The timer is unref'd so a pending sweep never blocks shutdown.
      const timer = (source as unknown as { timer: NodeJS.Timeout }).timer;
      expect(timer.hasRef()).toBe(false);
    });
  });
});
