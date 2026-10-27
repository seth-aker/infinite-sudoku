import { beforeEach, describe, expect, it } from "vitest";
import { PgValidateTokenDataSource } from "@/feature/auth/datasource/pgValidateTokenDataSource";
import { NotFoundError } from "@/core/errors/notFoundError";
import { createSqlMock, result, type SqlMock } from "#test/helpers/sql";
import { USER_ID } from "#test/helpers/fixtures";

const TOKEN = "validate-token";

describe("PgValidateTokenDataSource", () => {
  let db: SqlMock;
  let source: PgValidateTokenDataSource;

  beforeEach(() => {
    (PgValidateTokenDataSource as unknown as { instance: unknown }).instance =
      null;
    db = createSqlMock();
    source = PgValidateTokenDataSource.create(db.sql)!;
  });

  it("is a singleton", () => {
    expect(source).toBeInstanceOf(PgValidateTokenDataSource);
    expect(PgValidateTokenDataSource.create(createSqlMock().sql)).toBe(source);
  });

  describe("createValidateToken", () => {
    it("inserts a token for the user and returns it", async () => {
      db.enqueue(result([{ token: TOKEN }]));
      await expect(source.createValidateToken(USER_ID)).resolves.toBe(TOKEN);
      expect(db.calls[0].query).toContain("INSERT INTO validate_tokens");
      expect(db.calls[0].values).toEqual([USER_ID]);
    });
  });

  describe("validateEmail", () => {
    it("verifies the user and deletes the token in a transaction", async () => {
      db.enqueue(result([{ user_id: USER_ID }]), result([], 1), result([], 1));
      await expect(source.validateEmail(TOKEN)).resolves.toBe(true);
      expect(db.begin).toHaveBeenCalledTimes(1);
      expect(db.calls.map((c) => c.values)).toEqual([
        [TOKEN],
        [USER_ID],
        [TOKEN],
      ]);
      expect(db.calls[0].query).toContain("FROM validate_tokens");
      expect(db.calls[1].query).toContain("SET email_verified = true");
      expect(db.calls[2].query).toContain("DELETE FROM validate_tokens");
    });

    it("throws NotFoundError when the token does not exist", async () => {
      db.enqueue(result([]));
      const err = await source.validateEmail(TOKEN).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.message).toBe("Account not found");
      expect(db.calls).toHaveLength(1);
    });

    it("throws NotFoundError when the token row has no user", async () => {
      db.enqueue(result([{ user_id: "" }]));
      await expect(source.validateEmail(TOKEN)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("throws NotFoundError when no user was updated", async () => {
      db.enqueue(result([{ user_id: USER_ID }]), result([], 0));
      await expect(source.validateEmail(TOKEN)).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(db.calls).toHaveLength(2);
    });

    it("returns false when the token was not deleted", async () => {
      db.enqueue(result([{ user_id: USER_ID }]), result([], 1), result([], 0));
      await expect(source.validateEmail(TOKEN)).resolves.toBe(false);
    });
  });
});
