import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseError } from "@/core/errors/databaseError";
import { PgResetTokenDataSource } from "@/feature/auth/datasource/pgResetTokenDataSource";
import { fakeSql } from "#test/helpers/sql";
import { expectLogged } from "#test/helpers/logger";

const USER_ID = "3f0c7a4e-1b2d-4c5e-8f9a-0b1c2d3e4f5a";
const TOKEN = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

describe("PgResetTokenDataSource", () => {
  let db: ReturnType<typeof fakeSql>;
  let source: PgResetTokenDataSource;

  beforeEach(() => {
    vi.useFakeTimers();
    db = fakeSql();
    PgResetTokenDataSource.instance = null;
    source = PgResetTokenDataSource.create(db.sql);
  });

  afterEach(() => {
    source.close();
    vi.useRealTimers();
  });

  it("returns the same instance on later create calls", () => {
    expect(PgResetTokenDataSource.create(fakeSql().sql)).toBe(source);
  });

  describe("createResetToken", () => {
    it("inserts a token for the user and returns it", async () => {
      db.returns([{ reset_token: TOKEN }]);
      await expect(source.createResetToken(USER_ID)).resolves.toBe(TOKEN);
      expect(db.queries[0]!.values).toEqual([USER_ID]);
    });

    it("throws a DatabaseError when no row comes back", async () => {
      db.returns([]);
      await expect(source.createResetToken(USER_ID)).rejects.toBeInstanceOf(DatabaseError);
    });
  });

  describe("consumeToken", () => {
    it("returns the consumed token with camelCase fields", async () => {
      const createdAt = new Date("2026-06-01T12:00:00Z");
      db.returns([{ reset_token: TOKEN, user_id: USER_ID, created_at: createdAt }]);
      await expect(source.consumeToken(TOKEN)).resolves.toEqual({
        token: TOKEN,
        userId: USER_ID,
        createdAt,
      });
      expect(db.queries[0]!.values).toEqual([TOKEN]);
    });

    it("only consumes unused tokens", async () => {
      await source.consumeToken(TOKEN);
      expect(db.queries[0]!.text).toMatch(/SET status = 'USED'/);
      expect(db.queries[0]!.text).toMatch(/AND status = 'UNUSED'/);
    });

    it("returns undefined for an unknown or already used token", async () => {
      db.returns([]);
      await expect(source.consumeToken(TOKEN)).resolves.toBeUndefined();
    });

    it("returns undefined if more than one row matches", async () => {
      const row = { reset_token: TOKEN, user_id: USER_ID, created_at: new Date() };
      db.returns([row, row]);
      await expect(source.consumeToken(TOKEN)).resolves.toBeUndefined();
    });
  });

  describe("expired token sweep", () => {
    it("deletes tokens older than 15 minutes every 15 minutes", async () => {
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES_MS);
      expect(db.queries).toHaveLength(1);
      expect(db.queries[0]!.text).toMatch(
        /DELETE FROM reset_tokens WHERE created_at \+ INTERVAL '15 minutes' < now\(\)/,
      );
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES_MS);
      expect(db.queries).toHaveLength(2);
    });

    it("logs and keeps running when a sweep fails", async () => {
      const err = new Error("db down");
      db.fails(err);
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES_MS);
      expectLogged("error", expect.objectContaining({ err }));
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES_MS);
      expect(db.queries).toHaveLength(2);
    });

    it("stops after close()", async () => {
      source.close();
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES_MS * 2);
      expect(db.queries).toHaveLength(0);
    });

    it("does not keep the process alive", () => {
      // The sweep timer is unref'd so it never blocks shutdown.
      const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
      PgResetTokenDataSource.instance = null;
      const fresh = PgResetTokenDataSource.create(fakeSql().sql);
      const timer = setIntervalSpy.mock.results[0]!.value as NodeJS.Timeout;
      expect(timer.hasRef()).toBe(false);
      fresh.close();
    });
  });
});
