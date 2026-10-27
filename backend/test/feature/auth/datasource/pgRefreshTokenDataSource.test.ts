import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { PgRefreshTokenDataSource } from "@/feature/auth/datasource/pgRefreshTokenDataSource";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";
import { ErrorType } from "@/core/errors/errorTypes";
import { logger } from "@/core/logging/logger";
import { createSqlMock, result, type SqlMock } from "#test/helpers/sql";
import { USER_ID } from "#test/helpers/fixtures";

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const THIRTY_DAYS_S = 30 * 24 * 60 * 60;
const NOW = new Date("2026-06-01T00:00:00.000Z");

describe("PgRefreshTokenDataSource", () => {
  let db: SqlMock;
  let source: PgRefreshTokenDataSource;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    PgRefreshTokenDataSource.instance?.close();
    PgRefreshTokenDataSource.instance = null;
    db = createSqlMock();
    source = PgRefreshTokenDataSource.create(db.sql);
  });

  afterEach(() => {
    source.close();
    vi.useRealTimers();
  });

  describe("create (static)", () => {
    it("returns a singleton", () => {
      expect(PgRefreshTokenDataSource.create(createSqlMock().sql)).toBe(source);
      expect(PgRefreshTokenDataSource.instance).toBe(source);
    });
  });

  describe("expired token sweep", () => {
    it("deletes expired tokens every 15 minutes", async () => {
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES - 1);
      expect(db.calls).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(db.calls).toHaveLength(1);
      expect(db.calls[0].query).toBe(
        "DELETE FROM refresh_tokens WHERE expires_at < now()",
      );
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES);
      expect(db.calls).toHaveLength(2);
    });

    it("logs sweep failures without throwing", async () => {
      const err = new Error("db down");
      db.enqueue(err);
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES);
      expect(logger.error).toHaveBeenCalledWith(
        { err },
        "refresh token sweep failed",
      );
    });

    it("stops sweeping after close", async () => {
      source.close();
      await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES * 3);
      expect(db.calls).toHaveLength(0);
    });

    it("does not keep the process alive", () => {
      const unref = vi.fn();
      vi.spyOn(globalThis, "setInterval").mockReturnValueOnce({
        unref,
      } as never);
      source.close();
      PgRefreshTokenDataSource.instance = null;
      PgRefreshTokenDataSource.create(db.sql);
      expect(unref).toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("stores a hashed token and returns the raw token", async () => {
      const token = await source.create(USER_ID);
      expect(token).toMatch(/^[0-9a-f]{80}$/);
      expect(db.calls).toHaveLength(1);
      expect(db.calls[0].query).toContain("INSERT INTO refresh_tokens");
      expect(db.calls[0].values).toEqual([
        USER_ID,
        sha256(token),
        Math.ceil(NOW.getTime() / 1000) + THIRTY_DAYS_S,
      ]);
    });

    it("generates distinct tokens", async () => {
      expect(await source.create(USER_ID)).not.toBe(
        await source.create(USER_ID),
      );
    });

    it("propagates database errors", async () => {
      db.enqueue(new Error("insert failed"));
      await expect(source.create(USER_ID)).rejects.toThrow("insert failed");
    });
  });

  describe("rotateRefreshToken", () => {
    it("consumes the old token and issues a new one in a transaction", async () => {
      db.enqueue(
        result([
          { user_id: USER_ID, expires_at: new Date(NOW.getTime() + 1000) },
        ]),
      );
      const res = await source.rotateRefreshToken("old-token");

      expect(db.begin).toHaveBeenCalledTimes(1);
      expect(res.userId).toBe(USER_ID);
      expect(res.token).toMatch(/^[0-9a-f]{80}$/);
      expect(db.calls[0].query).toContain("DELETE FROM refresh_tokens");
      expect(db.calls[0].values).toEqual([sha256("old-token")]);
      expect(db.calls[1].query).toContain("INSERT INTO refresh_tokens");
      expect(db.calls[1].values).toEqual([
        USER_ID,
        sha256(res.token),
        Math.ceil(NOW.getTime() / 1000) + THIRTY_DAYS_S,
      ]);
    });

    it("throws TOKEN_INVALID when the token does not exist", async () => {
      db.enqueue(result([]));
      const err = await source.rotateRefreshToken("nope").catch((e) => e);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.code).toBe(ErrorType.TOKEN_INVALID);
      expect(err.message).toBe("Refresh token is invalid");
      expect(db.calls).toHaveLength(1);
    });

    it("throws TOKEN_EXPIRED when the token is expired", async () => {
      db.enqueue(
        result([{ user_id: USER_ID, expires_at: new Date(NOW.getTime() - 1) }]),
      );
      const err = await source.rotateRefreshToken("old").catch((e) => e);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.code).toBe(ErrorType.TOKEN_EXPIRED);
      expect(db.calls).toHaveLength(1);
    });

    it("accepts a token expiring exactly now", async () => {
      db.enqueue(result([{ user_id: USER_ID, expires_at: new Date(NOW) }]));
      await expect(source.rotateRefreshToken("old")).resolves.toMatchObject({
        userId: USER_ID,
      });
    });
  });

  describe("invalidateAllForUser", () => {
    it("deletes all tokens for the user", async () => {
      await source.invalidateAllForUser(USER_ID);
      expect(db.calls[0].query).toBe(
        "DELETE FROM refresh_tokens WHERE user_id = $;",
      );
      expect(db.calls[0].values).toEqual([USER_ID]);
    });
  });

  describe("delete", () => {
    it("deletes the hashed token", async () => {
      await source.delete("raw");
      expect(db.calls[0].query).toBe(
        "DELETE FROM refresh_tokens WHERE token = $;",
      );
      expect(db.calls[0].values).toEqual([sha256("raw")]);
    });
  });
});
