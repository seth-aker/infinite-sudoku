import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseError } from "@/core/errors/databaseError";
import { ErrorType } from "@/core/errors/errorTypes";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";
import { NotFoundError } from "@/core/errors/notFoundError";
import { PgValidateTokenDataSource } from "@/feature/auth/datasource/pgValidateTokenDataSource";
import { fakeSql } from "#test/helpers/sql";

const USER_ID = "3f0c7a4e-1b2d-4c5e-8f9a-0b1c2d3e4f5a";
const TOKEN = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
const NOW = new Date("2026-06-01T12:00:00Z");
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const createdAgo = (ms: number) => new Date(NOW.getTime() - ms);

describe("PgValidateTokenDataSource", () => {
  let db: ReturnType<typeof fakeSql>;
  let source: PgValidateTokenDataSource;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    db = fakeSql();
    PgValidateTokenDataSource.instance = null;
    source = PgValidateTokenDataSource.create(db.sql);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the same instance on later create calls", () => {
    expect(PgValidateTokenDataSource.create(fakeSql().sql)).toBe(source);
  });

  describe("createValidateToken", () => {
    it("inserts a token for the user and returns it", async () => {
      db.returns([{ token: TOKEN }]);
      await expect(source.createValidateToken(USER_ID)).resolves.toBe(TOKEN);
      expect(db.queries[0]!.values).toEqual([USER_ID]);
    });

    it("throws a DatabaseError when no row comes back", async () => {
      db.returns([]);
      await expect(source.createValidateToken(USER_ID)).rejects.toBeInstanceOf(DatabaseError);
    });
  });

  describe("validateEmail", () => {
    it("marks the user verified and deletes the token in one transaction", async () => {
      db.returns([{ user_id: USER_ID, created_at: createdAgo(60_000) }]).returns([], 1).returns([], 1);
      await expect(source.validateEmail(TOKEN)).resolves.toBe(true);

      expect(db.tag.begin).toHaveBeenCalledOnce();
      const [lookup, update, remove] = db.queries;
      expect(lookup!.values).toEqual([TOKEN]);
      expect(update!.text).toMatch(/UPDATE users SET email_verified = true/);
      expect(update!.values).toEqual([USER_ID]);
      expect(remove!.text).toMatch(/DELETE FROM validate_tokens/);
      expect(remove!.values).toEqual([TOKEN]);
    });

    it("throws NotFoundError for an unknown token without updating anything", async () => {
      db.returns([]);
      await expect(source.validateEmail(TOKEN)).rejects.toBeInstanceOf(NotFoundError);
      expect(db.queries).toHaveLength(1);
    });

    it("accepts a token just inside the 24 hour window", async () => {
      db.returns([{ user_id: USER_ID, created_at: createdAgo(TWENTY_FOUR_HOURS_MS - 1_000) }])
        .returns([], 1)
        .returns([], 1);
      await expect(source.validateEmail(TOKEN)).resolves.toBe(true);
    });

    it.each([
      ["older than 24 hours", { created_at: createdAgo(TWENTY_FOUR_HOURS_MS + 1_000) }],
      ["without a created_at", { created_at: null }],
    ])("rejects a token %s as TOKEN_EXPIRED without verifying", async (_label, row) => {
      db.returns([{ user_id: USER_ID, ...row }]);
      const err = await source.validateEmail(TOKEN).catch((e) => e);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.code).toBe(ErrorType.TOKEN_EXPIRED);
      expect(db.queries).toHaveLength(1);
    });

    it("throws NotFoundError when the user no longer exists", async () => {
      db.returns([{ user_id: USER_ID, created_at: createdAgo(60_000) }]).returns([], 0);
      await expect(source.validateEmail(TOKEN)).rejects.toBeInstanceOf(NotFoundError);
      expect(db.queries).toHaveLength(2);
    });

    it("returns false when the token was not deleted", async () => {
      // e.g. a concurrent request consumed it between the lookup and the delete.
      db.returns([{ user_id: USER_ID, created_at: createdAgo(60_000) }]).returns([], 1).returns([], 0);
      await expect(source.validateEmail(TOKEN)).resolves.toBe(false);
    });
  });
});
