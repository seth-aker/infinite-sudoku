import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes, scryptSync, type BinaryLike } from "node:crypto";
import { jwtVerify } from "jose";
import { config } from "@/core/config";
import { DatabaseError } from "@/core/errors/databaseError";
import { ErrorType } from "@/core/errors/errorTypes";
import { NotFoundError } from "@/core/errors/notFoundError";
import { logger } from "@/core/logging/logger";
import type { Emailer } from "@/core/email/smtpEmailer";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";
import { AuthorizationError } from "@/feature/auth/errors/authorizationError";
import { AuthenticationServiceImpl } from "@/feature/auth/service/authenticationServiceImpl";
import type { RefreshTokenDataSource } from "@/feature/auth/datasource/refreshTokenDataSource";
import type { ResetTokenDataSource } from "@/feature/auth/datasource/resetTokenDataSource";
import type { ValidateTokenDataSource } from "@/feature/auth/datasource/validateTokenDataSource";
import type { UserDataSource } from "@/feature/users/datasource/userDataSource";
import type { ISqlUser } from "@/feature/users/datasource/models/user";

const USER_ID = "3f0c7a4e-1b2d-4c5e-8f9a-0b1c2d3e4f5a";
const PASSWORD = "Str0ng!pass";
const SECRET = new TextEncoder().encode(config.jwtSecret);
const FIFTEEN_MINUTES = 15 * 60 * 1000;

// scrypt is slow on purpose (~50ms per hash at the default cost). Run the real
// algorithm with a tiny cost factor so these tests check the hashing logic
// without paying for production-strength hashing. Applies to the service and
// to the helpers below, so their hashes still match.
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  const CHEAP = { N: 16 };
  return {
    ...actual,
    scrypt: (password: BinaryLike, salt: BinaryLike, keylen: number, callback: (err: Error | null, key: Buffer) => void) =>
      actual.scrypt(password, salt, keylen, CHEAP, callback),
    scryptSync: (password: BinaryLike, salt: BinaryLike, keylen: number) =>
      actual.scryptSync(password, salt, keylen, CHEAP),
  };
});

// Same scheme as the service: scrypt, 16 byte salt, 64 byte key, hex encoded.
function hashed(password: string, salt = randomBytes(16)) {
  return {
    salt: salt.toString("hex"),
    password_hash: scryptSync(password.normalize(), salt, 64).toString("hex"),
  };
}

// Hashed once; most tests only need a user whose password is PASSWORD.
const PASSWORD_HASH = hashed(PASSWORD);

function sqlUser(overrides: Partial<ISqlUser> = {}): ISqlUser {
  return {
    user_id: USER_ID,
    email: "player@example.com",
    email_verified: true,
    username: "player",
    role: "user",
    ...PASSWORD_HASH,
    last_login_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

// PgUserDataSource.getUserByEmail resolves undefined for an unknown email.
const NO_USER = undefined;

describe("AuthenticationServiceImpl", () => {
  const users = {
    createUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getUser: vi.fn(),
    getUserStats: vi.fn(),
    changePassword: vi.fn(),
    deleteUser: vi.fn(),
  };
  const refreshTokens = {
    close: vi.fn(),
    rotateRefreshToken: vi.fn(),
    create: vi.fn(),
    invalidateAllForUser: vi.fn(),
    delete: vi.fn(),
  };
  const resetTokens = { createResetToken: vi.fn(), consumeToken: vi.fn() };
  const validateTokens = { createValidateToken: vi.fn(), validateEmail: vi.fn() };
  const emailer = { sendMail: vi.fn() };

  let service: AuthenticationServiceImpl;

  beforeEach(() => {
    // create() is a singleton; reset it so each test gets fresh mocks.
    AuthenticationServiceImpl.instance = null;
    service = AuthenticationServiceImpl.create(
      users as unknown as UserDataSource,
      refreshTokens as unknown as RefreshTokenDataSource,
      resetTokens as unknown as ResetTokenDataSource,
      validateTokens as unknown as ValidateTokenDataSource,
      emailer as unknown as Emailer,
    );

    users.getUser.mockResolvedValue(sqlUser());
    users.createUser.mockResolvedValue(USER_ID);
    refreshTokens.create.mockResolvedValue("refresh-token");
    validateTokens.createValidateToken.mockResolvedValue("validate-token");
    resetTokens.createResetToken.mockResolvedValue("reset-token");
    emailer.sendMail.mockResolvedValue({ messageId: "msg-1" });
  });

  async function claimsOf(accessToken: string) {
    const { payload } = await jwtVerify(accessToken, SECRET, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ["HS256"],
    });
    return payload;
  }

  describe("create", () => {
    it("returns the same instance on later calls", () => {
      const again = AuthenticationServiceImpl.create(
        {} as UserDataSource,
        {} as RefreshTokenDataSource,
        {} as ResetTokenDataSource,
        {} as ValidateTokenDataSource,
        {} as Emailer,
      );
      expect(again).toBe(service);
    });
  });

  describe("verify", () => {
    it("returns the user DTO for the correct password", async () => {
      users.getUserByEmail.mockResolvedValue(
        sqlUser({ image_url: "http://img.test/a.png", current_puzzle_id: "p1" }),
      );
      await expect(service.verify("player@example.com", PASSWORD)).resolves.toEqual({
        id: USER_ID,
        email: "player@example.com",
        emailVerified: true,
        username: "player",
        role: "user",
        imageUrl: "http://img.test/a.png",
        currentPuzzleId: "p1",
      });
      expect(users.getUserByEmail).toHaveBeenCalledWith("player@example.com");
    });

    it("maps null optional columns to undefined", async () => {
      users.getUserByEmail.mockResolvedValue(
        sqlUser({ image_url: null as never, current_puzzle_id: null as never }),
      );
      const dto = await service.verify("player@example.com", PASSWORD);
      expect(dto.imageUrl).toBeUndefined();
      expect(dto.currentPuzzleId).toBeUndefined();
    });

    it("normalises unicode so composed and decomposed passwords match", async () => {
      const composed = "Café!pass1A";
      const decomposed = "Café!pass1A";
      users.getUserByEmail.mockResolvedValue(sqlUser(hashed(composed)));
      await expect(service.verify("player@example.com", decomposed)).resolves.toBeDefined();
    });

    it("rejects a wrong password", async () => {
      users.getUserByEmail.mockResolvedValue(sqlUser());
      const err = await service.verify("player@example.com", "Wr0ng!pass").catch((e) => e);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.message).toBe("Incorrect Email or Password");
    });

    it("rejects an unknown email with the same error as a wrong password", async () => {
      users.getUserByEmail.mockResolvedValue(NO_USER);
      const err = await service.verify("nobody@example.com", PASSWORD).catch((e) => e);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.message).toBe("Incorrect Email or Password");
    });

    it("rejects a deleted user even with the correct password", async () => {
      users.getUserByEmail.mockResolvedValue(sqlUser({ deleted_at: "2026-02-01T00:00:00Z" }));
      await expect(service.verify("player@example.com", PASSWORD)).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    });

    it.each([
      ["no password hash", { password_hash: undefined }],
      ["no salt", { salt: undefined }],
    ])("rejects a user with %s", async (_label, overrides) => {
      users.getUserByEmail.mockResolvedValue(sqlUser(overrides));
      await expect(service.verify("player@example.com", PASSWORD)).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    });

    it("rejects a stored hash of the wrong length as bad credentials", async () => {
      users.getUserByEmail.mockResolvedValue(sqlUser({ password_hash: "abcd" }));
      await expect(service.verify("player@example.com", PASSWORD)).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    });

    it("rejects an unverified email only after the password matches", async () => {
      users.getUserByEmail.mockResolvedValue(sqlUser({ email_verified: false }));
      const err = await service.verify("player@example.com", PASSWORD).catch((e) => e);
      expect(err).toBeInstanceOf(AuthorizationError);
      expect(err.code).toBe(ErrorType.UNVERIFIED_EMAIL);
    });

    it("does not reveal that an email is unverified to a wrong password", async () => {
      users.getUserByEmail.mockResolvedValue(sqlUser({ email_verified: false }));
      await expect(service.verify("player@example.com", "Wr0ng!pass")).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    });
  });

  describe("registerUser", () => {
    const body = {
      email: "New@Example.com",
      username: "NewPlayer",
      password: PASSWORD,
      tosAcknowledged: true,
    };

    it("stores the email and username as entered, without the plaintext password", async () => {
      // Case is kept; the database compares emails and usernames case-insensitively.
      await service.registerUser(body);
      expect(users.createUser).toHaveBeenCalledOnce();
      const created = users.createUser.mock.calls[0]![0];
      expect(created).toMatchObject({
        email: "New@Example.com",
        username: "NewPlayer",
        tosAcknowledged: true,
        role: "user",
      });
      expect(JSON.stringify(created)).not.toContain(PASSWORD);
    });

    it("produces hashes that verify() accepts", async () => {
      await service.registerUser(body);
      const { passwordHash, salt } = users.createUser.mock.calls[0]![0];
      users.getUserByEmail.mockResolvedValue(sqlUser({ password_hash: passwordHash, salt }));
      await expect(service.verify("new@example.com", PASSWORD)).resolves.toBeDefined();
    });

    it("uses a fresh salt for every user", async () => {
      await service.registerUser(body);
      await service.registerUser(body);
      const [first, second] = users.createUser.mock.calls.map((c) => c[0]);
      expect(first.salt).not.toBe(second.salt);
      expect(first.passwordHash).not.toBe(second.passwordHash);
    });

    it("rejects registration without accepting the terms of service", async () => {
      const err = await service.registerUser({ ...body, tosAcknowledged: false }).catch((e) => e);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.code).toBe(ErrorType.VALIDATION_FAILED);
      expect(users.createUser).not.toHaveBeenCalled();
    });

    it("propagates createUser failures without issuing tokens or sending email", async () => {
      const err = new DatabaseError("INSERT INTO users returned no row");
      users.createUser.mockRejectedValue(err);
      await expect(service.registerUser(body)).rejects.toBe(err);
      expect(validateTokens.createValidateToken).not.toHaveBeenCalled();
      expect(refreshTokens.create).not.toHaveBeenCalled();
      expect(emailer.sendMail).not.toHaveBeenCalled();
    });

    it("sends a validation email linking to the frontend", async () => {
      await service.registerUser(body);
      expect(validateTokens.createValidateToken).toHaveBeenCalledWith(USER_ID);
      expect(emailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "New@Example.com",
          from: config.smtpUser,
          subject: "Infinite Sudoku: Validate Email",
        }),
      );
      const { html } = emailer.sendMail.mock.calls[0]![0];
      expect(html).toContain(`${config.origin}/auth/validateEmail?token=validate-token`);
    });

    it("returns the user id and a new token set", async () => {
      const result = await service.registerUser(body);
      expect(result).toEqual({
        userId: USER_ID,
        accessToken: expect.any(String),
        refreshToken: "refresh-token",
      });
      expect(refreshTokens.create).toHaveBeenCalledWith(USER_ID);
      expect((await claimsOf(result.accessToken)).sub).toBe(USER_ID);
    });

    it("still registers the user when the email fails to send, and logs it", async () => {
      // The account already exists at this point; the user can request a new
      // validation email instead of hitting a 409 on retry.
      const smtpErr = new Error("smtp down");
      emailer.sendMail.mockRejectedValue(smtpErr);
      await expect(service.registerUser(body)).resolves.toEqual({
        userId: USER_ID,
        accessToken: expect.any(String),
        refreshToken: "refresh-token",
      });
      expect(logger.error).toHaveBeenCalledWith(smtpErr);
    });
  });

  describe("getNewTokenSet", () => {
    it("creates a refresh token and a signed access token", async () => {
      const { accessToken, refreshToken } = await service.getNewTokenSet(USER_ID);
      expect(refreshToken).toBe("refresh-token");
      expect(refreshTokens.create).toHaveBeenCalledWith(USER_ID);
      expect(await claimsOf(accessToken)).toMatchObject({
        sub: USER_ID,
        role: "user",
        emailVerified: true,
        iss: config.issuer,
        aud: config.audience,
      });
    });

    it("signs the role and verification status from the database", async () => {
      users.getUser.mockResolvedValue(sqlUser({ role: "admin", email_verified: false }));
      const { accessToken } = await service.getNewTokenSet(USER_ID);
      expect(await claimsOf(accessToken)).toMatchObject({ role: "admin", emailVerified: false });
    });

    it("issues access tokens that expire after 15 minutes", async () => {
      const { accessToken } = await service.getNewTokenSet(USER_ID);
      const { iat, exp } = await claimsOf(accessToken);
      expect(exp! - iat!).toBe(15 * 60);
    });

    it("signs with HS256", async () => {
      const { accessToken } = await service.getNewTokenSet(USER_ID);
      const header = JSON.parse(Buffer.from(accessToken.split(".")[0]!, "base64url").toString());
      expect(header.alg).toBe("HS256");
    });
  });

  describe("refreshAccessToken", () => {
    it("rotates the refresh token and issues an access token for its user", async () => {
      refreshTokens.rotateRefreshToken.mockResolvedValue({ token: "rotated", userId: USER_ID });
      const result = await service.refreshAccessToken("old-token");
      expect(refreshTokens.rotateRefreshToken).toHaveBeenCalledWith("old-token");
      expect(result.refreshToken).toBe("rotated");
      expect((await claimsOf(result.accessToken)).sub).toBe(USER_ID);
    });

    it("propagates rotation failures without issuing a token", async () => {
      const err = new AuthenticationError("revoked", { type: ErrorType.TOKEN_REVOKED });
      refreshTokens.rotateRefreshToken.mockRejectedValue(err);
      await expect(service.refreshAccessToken("old-token")).rejects.toBe(err);
      expect(users.getUser).not.toHaveBeenCalled();
    });
  });

  describe("requestPasswordResetToken", () => {
    it("emails a reset link to a known user", async () => {
      users.getUserByEmail.mockResolvedValue(sqlUser());
      await service.requestPasswordResetToken("player@example.com");
      expect(resetTokens.createResetToken).toHaveBeenCalledWith(USER_ID);
      expect(emailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "player@example.com",
          from: config.smtpUser,
          subject: "Infinite Sudoku: Reset Password",
        }),
      );
      const { html } = emailer.sendMail.mock.calls[0]![0];
      expect(html).toContain(`${config.origin}/auth/reset-password?token=reset-token`);
    });

    it("succeeds silently for an unknown email so accounts cannot be discovered", async () => {
      users.getUserByEmail.mockResolvedValue(NO_USER);
      await expect(service.requestPasswordResetToken("nobody@example.com")).resolves.toBeUndefined();
      expect(resetTokens.createResetToken).not.toHaveBeenCalled();
      expect(emailer.sendMail).not.toHaveBeenCalled();
    });

    it("logs and rethrows when the email fails to send", async () => {
      users.getUserByEmail.mockResolvedValue(sqlUser());
      const smtpErr = new Error("smtp down");
      emailer.sendMail.mockRejectedValue(smtpErr);
      await expect(service.requestPasswordResetToken("player@example.com")).rejects.toBe(smtpErr);
      expect(logger.error).toHaveBeenCalledWith(smtpErr, expect.any(String));
    });
  });

  describe("requestEmailVerification", () => {
    it("emails a validation link to an unverified user", async () => {
      users.getUserByEmail.mockResolvedValue(sqlUser({ email_verified: false }));
      await service.requestEmailVerification("player@example.com");
      expect(validateTokens.createValidateToken).toHaveBeenCalledWith(USER_ID);
      const { to, html } = emailer.sendMail.mock.calls[0]![0];
      expect(to).toBe("player@example.com");
      expect(html).toContain(`${config.origin}/auth/validateEmail?token=validate-token`);
    });

    it("succeeds silently for an unknown email so accounts cannot be discovered", async () => {
      users.getUserByEmail.mockResolvedValue(NO_USER);
      await expect(service.requestEmailVerification("nobody@example.com")).resolves.toBeUndefined();
      expect(validateTokens.createValidateToken).not.toHaveBeenCalled();
      expect(emailer.sendMail).not.toHaveBeenCalled();
    });

    it("logs and rethrows when the email fails to send", async () => {
      users.getUserByEmail.mockResolvedValue(sqlUser({ email_verified: false }));
      const smtpErr = new Error("smtp down");
      emailer.sendMail.mockRejectedValue(smtpErr);
      await expect(service.requestEmailVerification("player@example.com")).rejects.toBe(smtpErr);
      expect(logger.error).toHaveBeenCalledWith(smtpErr, expect.any(String));
    });
  });

  describe("resetPassword", () => {
    const NEW_PASSWORD = "N3w!password";

    it("changes the password and signs the user out everywhere", async () => {
      resetTokens.consumeToken.mockResolvedValue({ token: "t", userId: USER_ID, createdAt: new Date() });
      await service.resetPassword("t", NEW_PASSWORD);
      expect(resetTokens.consumeToken).toHaveBeenCalledWith("t");
      expect(users.changePassword).toHaveBeenCalledOnce();
      const [userId, password_hash, salt] = users.changePassword.mock.calls[0]!;
      expect(userId).toBe(USER_ID);
      expect(refreshTokens.invalidateAllForUser).toHaveBeenCalledWith(USER_ID);
      // The stored credentials accept the new password and reject the old one.
      users.getUserByEmail.mockResolvedValue(sqlUser({ password_hash, salt }));
      await expect(service.verify("player@example.com", NEW_PASSWORD)).resolves.toBeDefined();
      await expect(service.verify("player@example.com", PASSWORD)).rejects.toBeInstanceOf(AuthenticationError);
    });

    it("accepts a token just inside the 15 minute window", async () => {
      resetTokens.consumeToken.mockResolvedValue({
        token: "t",
        userId: USER_ID,
        createdAt: new Date(Date.now() - FIFTEEN_MINUTES + 5_000),
      });
      await service.resetPassword("t", NEW_PASSWORD);
      expect(users.changePassword).toHaveBeenCalledOnce();
    });

    it("rejects an unknown or used token", async () => {
      resetTokens.consumeToken.mockResolvedValue(undefined);
      const err = await service.resetPassword("t", NEW_PASSWORD).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.code).toBe(ErrorType.TOKEN_INVALID);
      expect(users.changePassword).not.toHaveBeenCalled();
      expect(refreshTokens.invalidateAllForUser).not.toHaveBeenCalled();
    });

    it("rejects a token older than 15 minutes", async () => {
      resetTokens.consumeToken.mockResolvedValue({
        token: "t",
        userId: USER_ID,
        createdAt: new Date(Date.now() - FIFTEEN_MINUTES - 1_000),
      });
      const err = await service.resetPassword("t", NEW_PASSWORD).catch((e) => e);
      expect(err).toBeInstanceOf(AuthorizationError);
      expect(err.code).toBe(ErrorType.TOKEN_EXPIRED);
      expect(users.changePassword).not.toHaveBeenCalled();
      expect(refreshTokens.invalidateAllForUser).not.toHaveBeenCalled();
    });
  });
});
