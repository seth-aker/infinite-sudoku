import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";
import { PgResetTokenDataSource } from "@/feature/auth/datasource/pgResetTokenDataSource";
import { connect, resetDb } from "#test/integration/helpers/db";
import { insertResetToken, insertUser } from "#test/integration/helpers/fixtures";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);

describe("PgResetTokenDataSource", () => {
  let sql: Sql;
  let tokens: PgResetTokenDataSource;
  let userId: string;

  beforeAll(() => {
    sql = connect();
    // The datasource is a singleton; drop any instance bound to another client.
    PgResetTokenDataSource.instance = null;
    tokens = PgResetTokenDataSource.create(sql);
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
    sql<{ user_id: string; reset_token: string; status: string }[]>`
      SELECT user_id, reset_token, status FROM reset_tokens ORDER BY id
    `;

  describe("createResetToken", () => {
    it("stores an unused token for the user and returns it", async () => {
      const token = await tokens.createResetToken(userId);
      expect(token).toMatch(UUID_RE);
      expect(await stored()).toEqual([{ user_id: userId, reset_token: token, status: "UNUSED" }]);
    });

    it("issues a different token each time", async () => {
      expect(await tokens.createResetToken(userId)).not.toBe(await tokens.createResetToken(userId));
    });
  });

  describe("consumeToken", () => {
    it("returns the token's user and creation time, and marks it used", async () => {
      const createdAt = minutesAgo(5);
      const token = await insertResetToken(sql, { user_id: userId }, { created_at: createdAt });

      await expect(tokens.consumeToken(token)).resolves.toEqual({ token, userId, createdAt });
      expect(await stored()).toEqual([expect.objectContaining({ reset_token: token, status: "USED" })]);
    });

    it("only works once", async () => {
      const token = await insertResetToken(sql, { user_id: userId });
      await tokens.consumeToken(token);
      await expect(tokens.consumeToken(token)).resolves.toBeUndefined();
    });

    it("returns undefined for an already used token", async () => {
      const token = await insertResetToken(sql, { user_id: userId }, { status: "USED" });
      await expect(tokens.consumeToken(token)).resolves.toBeUndefined();
    });

    it("returns undefined for an unknown token", async () => {
      await insertResetToken(sql, { user_id: userId });
      await expect(tokens.consumeToken(crypto.randomUUID())).resolves.toBeUndefined();
    });

    it("leaves the user's other tokens unused", async () => {
      const used = await insertResetToken(sql, { user_id: userId });
      const other = await insertResetToken(sql, { user_id: userId });
      await tokens.consumeToken(used);
      expect(await stored()).toContainEqual(expect.objectContaining({ reset_token: other, status: "UNUSED" }));
    });
  });

  describe("expired token sweep", () => {
    let sweeping: PgResetTokenDataSource;

    beforeEach(() => {
      // Only setInterval is faked, so the postgres client's own timers still work.
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      PgResetTokenDataSource.instance = null;
      sweeping = PgResetTokenDataSource.create(sql);
    });

    afterEach(() => {
      sweeping.close();
      vi.useRealTimers();
    });

    it("deletes tokens older than 15 minutes, used or not, and keeps newer ones", async () => {
      const fresh = await insertResetToken(sql, { user_id: userId }, { created_at: minutesAgo(14) });
      await insertResetToken(sql, { user_id: userId }, { created_at: minutesAgo(16) });
      await insertResetToken(sql, { user_id: userId }, { created_at: minutesAgo(16), status: "USED" });

      await vi.advanceTimersByTimeAsync(15 * 60 * 1000);

      await vi.waitFor(async () => {
        expect((await stored()).map((r) => r.reset_token)).toEqual([fresh]);
      });
    });
  });
});
