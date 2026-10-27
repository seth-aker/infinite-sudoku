import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PgResetTokenDataSource } from "@/feature/auth/datasource/pgResetTokenDataSource";
import { logger } from "@/core/logging/logger";
import { createSqlMock, result, type SqlMock } from "#test/helpers/sql";
import { RESET_TOKEN, USER_ID } from "#test/helpers/fixtures";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

describe("PgResetTokenDataSource", () => {
  let db: SqlMock;
  let source: PgResetTokenDataSource;

  beforeEach(() => {
    vi.useFakeTimers();
    PgResetTokenDataSource.instance = null;
    db = createSqlMock();
    source = PgResetTokenDataSource.create(db.sql);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("is a singleton", () => {
    expect(PgResetTokenDataSource.create(createSqlMock().sql)).toBe(source);
  });

  describe("stale token sweep", () => {
    it("deletes tokens older than 15 minutes every 15 minutes", async () => {
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES);
      expect(db.calls).toHaveLength(1);
      expect(db.calls[0].query).toBe(
        "DELETE FROM reset_tokens WHERE created_at + INTERVAL '15 minutes' < now()",
      );
    });

    it("logs sweep failures", async () => {
      const err = new Error("db down");
      db.enqueue(err);
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES);
      expect(logger.error).toHaveBeenCalledWith(
        { err },
        "refresh token sweep failed",
      );
    });
  });

  describe("createResetToken", () => {
    it("inserts a token for the user and returns it", async () => {
      db.enqueue(result([{ reset_token: RESET_TOKEN }]));
      await expect(source.createResetToken(USER_ID)).resolves.toBe(RESET_TOKEN);
      expect(db.calls[0].query).toContain("INSERT INTO reset_tokens");
      expect(db.calls[0].values).toEqual([USER_ID]);
    });

    it("propagates database errors", async () => {
      db.enqueue(new Error("fk violation"));
      await expect(source.createResetToken(USER_ID)).rejects.toThrow(
        "fk violation",
      );
    });
  });

  describe("consumeToken", () => {
    it("marks an unused token as used and returns it", async () => {
      const createdAt = new Date();
      db.enqueue(
        result([
          { user_id: USER_ID, reset_token: RESET_TOKEN, created_at: createdAt },
        ]),
      );
      await expect(source.consumeToken(RESET_TOKEN)).resolves.toEqual({
        userId: USER_ID,
        token: RESET_TOKEN,
        createdAt,
      });
      expect(db.calls[0].query).toContain("SET status = 'USED'");
      expect(db.calls[0].query).toContain("status = 'UNUSED'");
      expect(db.calls[0].values).toEqual([RESET_TOKEN]);
    });

    it("returns undefined when no unused token matches", async () => {
      db.enqueue(result([]));
      await expect(source.consumeToken(RESET_TOKEN)).resolves.toBeUndefined();
    });

    it("returns undefined when more than one row is affected", async () => {
      const row = {
        user_id: USER_ID,
        reset_token: RESET_TOKEN,
        created_at: new Date(),
      };
      db.enqueue(result([row, row]));
      await expect(source.consumeToken(RESET_TOKEN)).resolves.toBeUndefined();
    });
  });
});
