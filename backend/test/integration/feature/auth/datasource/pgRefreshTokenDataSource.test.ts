import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import { ErrorType } from "@/core/errors/errorTypes";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";
import { PgRefreshTokenDataSource } from "@/feature/auth/datasource/pgRefreshTokenDataSource";
import { connect, resetDb } from "#test/integration/helpers/db";
import { insertRefreshToken, insertUser } from "#test/integration/helpers/fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

describe("PgRefreshTokenDataSource", () => {
  let sql: Sql;
  let tokens: PgRefreshTokenDataSource;
  let userId: string;

  beforeAll(() => {
    sql = connect();
    // The datasource is a singleton; drop any instance bound to another client.
    PgRefreshTokenDataSource.instance = null;
    tokens = PgRefreshTokenDataSource.create(sql);
  });

  beforeEach(async () => {
    await resetDb(sql);
    userId = await insertUser(sql);
  });

  afterAll(async () => {
    tokens.close();
    await sql.end();
  });

  const stored = () =>
    sql<{ user_id: string; token: string; expires_at: Date }[]>`
      SELECT user_id, token, expires_at FROM refresh_tokens ORDER BY id
    `;

  describe("create", () => {
    it("stores only the token's hash, for the user", async () => {
      const token = await tokens.create(userId);
      expect(await stored()).toEqual([
        { user_id: userId, token: sha256(token), expires_at: expect.any(Date) },
      ]);
    });

    it("expires the token in 30 days", async () => {
      const before = Date.now();
      await tokens.create(userId);
      const { expires_at } = (await stored())[0]!;
      // Rounded up to whole seconds for to_timestamp, so allow a little slack.
      expect(expires_at.getTime()).toBeGreaterThanOrEqual(before + 30 * DAY_MS - 1_000);
      expect(expires_at.getTime()).toBeLessThanOrEqual(Date.now() + 30 * DAY_MS + 1_000);
    });

    it("issues a different token each time", async () => {
      expect(await tokens.create(userId)).not.toBe(await tokens.create(userId));
      expect(await stored()).toHaveLength(2);
    });
  });

  describe("rotateRefreshToken", () => {
    it("replaces the token with a new one for the same user", async () => {
      const old = await insertRefreshToken(sql, { user_id: userId });

      const { token, userId: rotatedFor } = await tokens.rotateRefreshToken(old);

      expect(rotatedFor).toBe(userId);
      expect(token).not.toBe(old);
      expect(await stored()).toEqual([
        { user_id: userId, token: sha256(token), expires_at: expect.any(Date) },
      ]);
    });

    it("accepts the new token on the next rotation", async () => {
      const old = await insertRefreshToken(sql, { user_id: userId });
      const { token } = await tokens.rotateRefreshToken(old);
      await expect(tokens.rotateRefreshToken(token)).resolves.toMatchObject({ userId });
    });

    it("rejects a token that was already rotated", async () => {
      const old = await insertRefreshToken(sql, { user_id: userId });
      await tokens.rotateRefreshToken(old);

      const err = await tokens.rotateRefreshToken(old).catch((e) => e);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.code).toBe(ErrorType.TOKEN_INVALID);
    });

    it("rejects an unknown token as TOKEN_INVALID", async () => {
      const err = await tokens.rotateRefreshToken("not-a-real-token").catch((e) => e);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.code).toBe(ErrorType.TOKEN_INVALID);
    });

    it("rejects an expired token as TOKEN_EXPIRED without issuing a new one", async () => {
      const old = await insertRefreshToken(sql, { user_id: userId }, { expires_at: new Date(Date.now() - 1_000) });

      const err = await tokens.rotateRefreshToken(old).catch((e) => e);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.code).toBe(ErrorType.TOKEN_EXPIRED);
      const newTokens = (await stored()).filter((r) => r.token !== sha256(old));
      expect(newTokens).toEqual([]);
    });

    it("leaves the user's other tokens alone", async () => {
      const phone = await insertRefreshToken(sql, { user_id: userId });
      const laptop = await insertRefreshToken(sql, { user_id: userId });
      await tokens.rotateRefreshToken(phone);
      expect((await stored()).map((r) => r.token)).toContain(sha256(laptop));
    });
  });

  describe("delete", () => {
    it("revokes only the given token", async () => {
      const revoked = await insertRefreshToken(sql, { user_id: userId });
      const kept = await insertRefreshToken(sql, { user_id: userId });

      await tokens.delete(revoked);

      expect((await stored()).map((r) => r.token)).toEqual([sha256(kept)]);
      await expect(tokens.rotateRefreshToken(revoked)).rejects.toMatchObject({
        code: ErrorType.TOKEN_INVALID,
      });
    });
  });

  describe("invalidateAllForUser", () => {
    it("revokes every token the user has, and no one else's", async () => {
      const otherId = await insertUser(sql);
      await insertRefreshToken(sql, { user_id: userId });
      await insertRefreshToken(sql, { user_id: userId });
      const theirs = await insertRefreshToken(sql, { user_id: otherId });

      await tokens.invalidateAllForUser(userId);

      expect(await stored()).toEqual([
        { user_id: otherId, token: sha256(theirs), expires_at: expect.any(Date) },
      ]);
    });
  });

  describe("expired token sweep", () => {
    let sweeping: PgRefreshTokenDataSource;

    beforeEach(() => {
      // Only setInterval is faked, so the postgres client's own timers still work.
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      PgRefreshTokenDataSource.instance = null;
      sweeping = PgRefreshTokenDataSource.create(sql);
    });

    afterEach(() => {
      sweeping.close();
      vi.useRealTimers();
    });

    it("deletes expired tokens and keeps live ones", async () => {
      const live = await insertRefreshToken(sql, { user_id: userId });
      await insertRefreshToken(sql, { user_id: userId }, { expires_at: new Date(Date.now() - 1_000) });

      await vi.advanceTimersByTimeAsync(15 * 60 * 1000);

      await vi.waitFor(async () => {
        expect((await stored()).map((r) => r.token)).toEqual([sha256(live)]);
      });
    });
  });
});
