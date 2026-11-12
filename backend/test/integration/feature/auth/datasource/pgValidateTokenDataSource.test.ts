import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";
import { ErrorType } from "@/core/errors/errorTypes";
import { NotFoundError } from "@/core/errors/notFoundError";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";
import { PgValidateTokenDataSource } from "@/feature/auth/datasource/pgValidateTokenDataSource";
import { connect, resetDb } from "#test/integration/helpers/db";
import { insertUser, insertValidateToken } from "#test/integration/helpers/fixtures";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

describe("PgValidateTokenDataSource", () => {
  let sql: Sql;
  let tokens: PgValidateTokenDataSource;
  let userId: string;

  beforeAll(() => {
    sql = connect();
    // The datasource is a singleton; drop any instance bound to another client.
    PgValidateTokenDataSource.instance = null;
    tokens = PgValidateTokenDataSource.create(sql);
  });

  beforeEach(async () => {
    await resetDb(sql);
    userId = await insertUser(sql, { email_verified: false });
  });

  afterAll(async () => {
    tokens.close();
    await sql.end();
  });

  const isVerified = async (id: string) => {
    const [row] = await sql<{ email_verified: boolean }[]>`
      SELECT email_verified FROM users WHERE user_id = ${id}
    `;
    return row!.email_verified;
  };

  const storedTokens = () => sql<{ token: string }[]>`SELECT token FROM validate_tokens ORDER BY id`;

  describe("createValidateToken", () => {
    it("stores a token for the user and returns it", async () => {
      const token = await tokens.createValidateToken(userId);
      expect(token).toMatch(UUID_RE);
      expect(await sql`SELECT user_id, token FROM validate_tokens`).toEqual([
        { user_id: userId, token },
      ]);
    });

    it("issues a different token each time", async () => {
      expect(await tokens.createValidateToken(userId)).not.toBe(await tokens.createValidateToken(userId));
    });
  });

  describe("validateEmail", () => {
    it("verifies the user's email, consumes the token and returns true", async () => {
      const token = await insertValidateToken(sql, { user_id: userId });

      await expect(tokens.validateEmail(token)).resolves.toBe(true);
      expect(await isVerified(userId)).toBe(true);
      expect(await storedTokens()).toEqual([]);
    });

    it("only verifies the token's user", async () => {
      const otherId = await insertUser(sql, { email_verified: false });
      const token = await insertValidateToken(sql, { user_id: userId });
      await tokens.validateEmail(token);
      expect(await isVerified(otherId)).toBe(false);
    });

    it("rejects a token that was already used", async () => {
      const token = await insertValidateToken(sql, { user_id: userId });
      await tokens.validateEmail(token);
      await expect(tokens.validateEmail(token)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws a NotFoundError for an unknown token", async () => {
      await expect(tokens.validateEmail(crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
    });

    it("accepts a token just inside the 24 hour window", async () => {
      const token = await insertValidateToken(sql, { user_id: userId }, { created_at: hoursAgo(23.9) });
      await expect(tokens.validateEmail(token)).resolves.toBe(true);
      expect(await isVerified(userId)).toBe(true);
    });

    it("treats a token for a deleted user as not found, without verifying", async () => {
      const deletedId = await insertUser(sql, { email_verified: false, deleted_at: new Date() });
      const token = await insertValidateToken(sql, { user_id: deletedId });

      await expect(tokens.validateEmail(token)).rejects.toBeInstanceOf(NotFoundError);
      expect(await isVerified(deletedId)).toBe(false);
    });

    it("rejects a token older than 24 hours as TOKEN_EXPIRED without verifying", async () => {
      const token = await insertValidateToken(sql, { user_id: userId }, { created_at: hoursAgo(24.1) });

      const err = await tokens.validateEmail(token).catch((e) => e);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.code).toBe(ErrorType.TOKEN_EXPIRED);
      expect(await isVerified(userId)).toBe(false);
    });
  });

  describe("expired token sweep", () => {
    let sweeping: PgValidateTokenDataSource;

    beforeEach(() => {
      // Only setInterval is faked, so the postgres client's own timers still work.
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      PgValidateTokenDataSource.instance = null;
      sweeping = PgValidateTokenDataSource.create(sql);
    });

    afterEach(() => {
      sweeping.close();
      vi.useRealTimers();
    });

    it("deletes tokens older than 24 hours and keeps newer ones", async () => {
      const fresh = await insertValidateToken(sql, { user_id: userId }, { created_at: hoursAgo(23) });
      await insertValidateToken(sql, { user_id: userId }, { created_at: hoursAgo(25) });

      // Long enough for one sweep whatever the interval, up to a day.
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

      await vi.waitFor(async () => {
        expect((await storedTokens()).map((r) => r.token)).toEqual([fresh]);
      });
    });
  });
});
