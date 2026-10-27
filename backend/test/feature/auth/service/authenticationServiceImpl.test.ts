import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes, scryptSync } from "node:crypto";
import { decodeJwt, jwtVerify } from "jose";
import { AuthenticationServiceImpl } from "@/feature/auth/service/authenticationServiceImpl";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";
import { AuthorizationError } from "@/feature/auth/errors/authorizationError";
import { DatabaseError } from "@/core/errors/databaseError";
import { GenericError } from "@/core/errors/genericError";
import { NotFoundError } from "@/core/errors/notFoundError";
import { BadRequestError } from "@/core/errors/badRequestError";
import { ErrorType } from "@/core/errors/errorTypes";
import { config } from "@/core/config";
import { logger } from "@/core/logging/logger";
import { generateValidateEmailTemplate } from "@/feature/auth/email/templates/validateEmailTemplate";
import { generatePasswordResetEmailBody } from "@/feature/auth/email/templates/passwordResetTemplate";
import {
  mockEmailer,
  mockRefreshTokenDataSource,
  mockResetTokenDataSource,
  mockUserDataSource,
  mockValidateTokenDataSource,
} from "#test/helpers/mocks";
import {
  buildSqlUser,
  RESET_TOKEN,
  USER_ID,
  VALID_PASSWORD,
} from "#test/helpers/fixtures";

function hashWithSalt(password: string, salt = randomBytes(16)) {
  return {
    salt: salt.toString("hex"),
    password_hash: scryptSync(password, salt, 64).toString("hex"),
  };
}

function expectHashMatches(password: string, hash: string, salt: string) {
  expect(hash).toMatch(/^[0-9a-f]{128}$/);
  expect(salt).toMatch(/^[0-9a-f]{32}$/);
  expect(
    scryptSync(password, Buffer.from(salt, "hex"), 64).toString("hex"),
  ).toBe(hash);
}

describe("AuthenticationServiceImpl", () => {
  let users: ReturnType<typeof mockUserDataSource>;
  let refreshTokens: ReturnType<typeof mockRefreshTokenDataSource>;
  let resetTokens: ReturnType<typeof mockResetTokenDataSource>;
  let validateTokens: ReturnType<typeof mockValidateTokenDataSource>;
  let emailer: ReturnType<typeof mockEmailer>;
  let service: AuthenticationServiceImpl;

  beforeEach(() => {
    AuthenticationServiceImpl.instance = null;
    users = mockUserDataSource();
    refreshTokens = mockRefreshTokenDataSource();
    resetTokens = mockResetTokenDataSource();
    validateTokens = mockValidateTokenDataSource();
    emailer = mockEmailer();
    service = AuthenticationServiceImpl.create(
      users,
      refreshTokens,
      resetTokens,
      validateTokens,
      emailer,
    );
    users.getUser.mockResolvedValue(buildSqlUser());
    refreshTokens.create.mockResolvedValue("refresh-token");
    emailer.sendMail.mockResolvedValue({ messageId: "msg-1" } as never);
  });

  describe("create", () => {
    it("returns a singleton", () => {
      const again = AuthenticationServiceImpl.create(
        mockUserDataSource(),
        mockRefreshTokenDataSource(),
        mockResetTokenDataSource(),
        mockValidateTokenDataSource(),
        mockEmailer(),
      );
      expect(again).toBe(service);
    });
  });

  describe("verify", () => {
    it("returns the user DTO for valid credentials", async () => {
      users.getUserByEmail.mockResolvedValue(
        buildSqlUser(hashWithSalt(VALID_PASSWORD)),
      );
      await expect(
        service.verify("user@example.com", VALID_PASSWORD),
      ).resolves.toEqual({
        id: USER_ID,
        email: "user@example.com",
        username: "player",
        role: "user",
        imageUrl: "http://img.test/a.png",
        currentPuzzleId: buildSqlUser().current_puzzle_id,
      });
      expect(users.getUserByEmail).toHaveBeenCalledWith("user@example.com");
    });

    it("maps null optional fields to undefined", async () => {
      users.getUserByEmail.mockResolvedValue(
        buildSqlUser({
          ...hashWithSalt(VALID_PASSWORD),
          image_url: null as never,
          current_puzzle_id: null as never,
        }),
      );
      const dto = await service.verify("user@example.com", VALID_PASSWORD);
      expect(dto.imageUrl).toBeUndefined();
      expect(dto.currentPuzzleId).toBeUndefined();
    });

    it("normalizes the password before hashing", async () => {
      const nfc = "Caf\u00e9!Pass1";
      const nfd = "Cafe\u0301!Pass1";
      users.getUserByEmail.mockResolvedValue(buildSqlUser(hashWithSalt(nfc)));
      await expect(service.verify("u", nfd)).resolves.toMatchObject({
        id: USER_ID,
      });
    });

    it("rejects a wrong password", async () => {
      users.getUserByEmail.mockResolvedValue(
        buildSqlUser(hashWithSalt(VALID_PASSWORD)),
      );
      const err = await service.verify("u", "wrong").catch((e) => e);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.code).toBe(ErrorType.INVALID_CREDENTIALS);
      expect(err.message).toBe("Incorrect Email or Password");
    });

    it("rejects soft-deleted users even with the right password", async () => {
      users.getUserByEmail.mockResolvedValue(
        buildSqlUser({
          ...hashWithSalt(VALID_PASSWORD),
          deleted_at: "2026-01-01",
        }),
      );
      await expect(service.verify("u", VALID_PASSWORD)).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    });

    it("rejects users without a salt", async () => {
      const { password_hash } = hashWithSalt(VALID_PASSWORD);
      users.getUserByEmail.mockResolvedValue(
        buildSqlUser({ password_hash, salt: undefined }),
      );
      await expect(service.verify("u", VALID_PASSWORD)).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    });

    it("rejects users without a password hash", async () => {
      const { salt } = hashWithSalt(VALID_PASSWORD);
      users.getUserByEmail.mockResolvedValue(
        buildSqlUser({ salt, password_hash: undefined }),
      );
      await expect(service.verify("u", VALID_PASSWORD)).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    });

    it("rejects users with neither salt nor hash", async () => {
      users.getUserByEmail.mockResolvedValue(buildSqlUser());
      await expect(
        service.verify("u", "not-a-real-password"),
      ).rejects.toBeInstanceOf(AuthenticationError);
    });

    it("rejects unverified emails after checking the password", async () => {
      users.getUserByEmail.mockResolvedValue(
        buildSqlUser({
          ...hashWithSalt(VALID_PASSWORD),
          email_verified: false,
        }),
      );
      const err = await service.verify("u", VALID_PASSWORD).catch((e) => e);
      expect(err).toBeInstanceOf(AuthorizationError);
      expect(err.code).toBe(ErrorType.UNVERIFIED_EMAIL);
    });

    it("reports bad credentials before unverified email", async () => {
      users.getUserByEmail.mockResolvedValue(
        buildSqlUser({
          ...hashWithSalt(VALID_PASSWORD),
          email_verified: false,
        }),
      );
      await expect(service.verify("u", "wrong")).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    });

    it("propagates lookup errors such as unknown emails", async () => {
      users.getUserByEmail.mockRejectedValue(new NotFoundError("nope"));
      await expect(service.verify("u", "p")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("throws when the stored hash has an unexpected length", async () => {
      users.getUserByEmail.mockResolvedValue(
        buildSqlUser({ salt: "00", password_hash: "abcd" }),
      );
      await expect(service.verify("u", "p")).rejects.toThrow(RangeError);
    });
  });

  describe("registerUser", () => {
    const newUser = {
      email: "New@User.COM",
      username: "NewBie",
      password: VALID_PASSWORD,
      tosAcknowledged: true,
    };

    beforeEach(() => {
      users.createUser.mockResolvedValue(USER_ID);
      validateTokens.createValidateToken.mockResolvedValue("validate-tok");
    });

    it("creates the user with lowercased identifiers and a hashed password", async () => {
      await service.registerUser(newUser);
      const created = users.createUser.mock.calls[0][0];
      expect(created).toMatchObject({
        email: "new@user.com",
        username: "newbie",
        tosAcknowledged: true,
        role: "user",
      });
      expect(created.passwordHash).not.toContain(VALID_PASSWORD);
      expectHashMatches(VALID_PASSWORD, created.passwordHash, created.salt);
    });

    it("uses a random salt per registration", async () => {
      await service.registerUser(newUser);
      await service.registerUser(newUser);
      const [a, b] = users.createUser.mock.calls.map((c) => c[0]);
      expect(a.salt).not.toBe(b.salt);
      expect(a.passwordHash).not.toBe(b.passwordHash);
    });

    it("returns the user id and a token set", async () => {
      const res = await service.registerUser(newUser);
      expect(res.userId).toBe(USER_ID);
      expect(res.refreshToken).toBe("refresh-token");
      expect(decodeJwt(res.accessToken).sub).toBe(USER_ID);
      expect(refreshTokens.create).toHaveBeenCalledWith(USER_ID);
    });

    it("sends a verification email", async () => {
      await service.registerUser(newUser);
      expect(validateTokens.createValidateToken).toHaveBeenCalledWith(USER_ID);
      expect(emailer.sendMail).toHaveBeenCalledWith({
        to: newUser.email,
        from: config.smtpUser,
        subject: "Infinite Sudoku: Validate Email",
        html: generateValidateEmailTemplate("validate-tok", config.origin),
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("MessageId: msg-1"),
      );
    });

    it("rejects when terms of service are not acknowledged", async () => {
      const err = await service
        .registerUser({ ...newUser, tosAcknowledged: false })
        .catch((e) => e);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.code).toBe(ErrorType.VALIDATION_FAILED);
      expect(users.createUser).not.toHaveBeenCalled();
    });

    it("throws a DatabaseError when no user id is returned", async () => {
      users.createUser.mockResolvedValue(undefined);
      await expect(service.registerUser(newUser)).rejects.toBeInstanceOf(
        DatabaseError,
      );
      expect(validateTokens.createValidateToken).not.toHaveBeenCalled();
    });

    it("propagates createUser errors", async () => {
      users.createUser.mockRejectedValue(new Error("duplicate"));
      await expect(service.registerUser(newUser)).rejects.toThrow("duplicate");
    });

    it("throws a GenericError when the email fails to send", async () => {
      const sendError = new Error("smtp down");
      emailer.sendMail.mockRejectedValue(sendError);
      const err = await service.registerUser(newUser).catch((e) => e);
      expect(err).toBeInstanceOf(GenericError);
      expect(err.message).toBe("Internal server error");
      expect(logger.error).toHaveBeenCalledWith(sendError);
    });
  });

  describe("access tokens", () => {
    const secret = new TextEncoder().encode(config.jwtSecret);

    it("getNewTokenSet issues a refresh token and a signed access token", async () => {
      users.getUser.mockResolvedValue(
        buildSqlUser({ role: "admin", email_verified: false }),
      );
      const { accessToken, refreshToken } =
        await service.getNewTokenSet(USER_ID);

      expect(refreshToken).toBe("refresh-token");
      expect(refreshTokens.create).toHaveBeenCalledWith(USER_ID);
      expect(users.getUser).toHaveBeenCalledWith(USER_ID);

      const { payload, protectedHeader } = await jwtVerify(
        accessToken,
        secret,
        { issuer: config.issuer, audience: config.audience },
      );
      expect(protectedHeader.alg).toBe("HS256");
      expect(payload).toMatchObject({
        sub: USER_ID,
        role: "admin",
        email_verified: false,
      });
      expect(payload.exp! - payload.iat!).toBe(15 * 60);
    });

    it("getNewTokenSet propagates user lookup failures", async () => {
      users.getUser.mockRejectedValue(new NotFoundError("gone"));
      await expect(service.getNewTokenSet(USER_ID)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("refreshAccessToken rotates the refresh token", async () => {
      refreshTokens.rotateRefreshToken.mockResolvedValue({
        token: "new-refresh",
        userId: USER_ID,
      });
      const res = await service.refreshAccessToken("old-refresh");
      expect(refreshTokens.rotateRefreshToken).toHaveBeenCalledWith(
        "old-refresh",
      );
      expect(res.refreshToken).toBe("new-refresh");
      const { payload } = await jwtVerify(res.accessToken, secret);
      expect(payload.sub).toBe(USER_ID);
    });

    it("refreshAccessToken propagates rotation failures", async () => {
      refreshTokens.rotateRefreshToken.mockRejectedValue(
        new AuthenticationError("expired"),
      );
      await expect(service.refreshAccessToken("x")).rejects.toBeInstanceOf(
        AuthenticationError,
      );
      expect(users.getUser).not.toHaveBeenCalled();
    });
  });

  describe("clearRefreshToken", () => {
    it("deletes the token", async () => {
      await service.clearRefreshToken("tok");
      expect(refreshTokens.delete).toHaveBeenCalledWith("tok");
    });
  });

  describe("requestPasswordResetToken", () => {
    it("creates a reset token and emails it", async () => {
      users.getUserByEmail.mockResolvedValue(buildSqlUser());
      resetTokens.createResetToken.mockResolvedValue(RESET_TOKEN);

      await service.requestPasswordResetToken("User@Example.com");

      expect(resetTokens.createResetToken).toHaveBeenCalledWith(USER_ID);
      expect(emailer.sendMail).toHaveBeenCalledWith({
        to: "user@example.com",
        from: config.smtpUser,
        subject: "Infinite Sudoku: Reset Password",
        html: generatePasswordResetEmailBody(RESET_TOKEN, config.origin),
      });
      expect(logger.info).toHaveBeenCalledWith("Reset email sent: msg-1");
    });

    it("does nothing when no user is returned", async () => {
      users.getUserByEmail.mockResolvedValue(undefined as never);
      await expect(
        service.requestPasswordResetToken("x@y.z"),
      ).resolves.toBeUndefined();
      expect(resetTokens.createResetToken).not.toHaveBeenCalled();
      expect(emailer.sendMail).not.toHaveBeenCalled();
    });

    it("logs and rethrows lookup failures", async () => {
      const err = new NotFoundError("User email not found");
      users.getUserByEmail.mockRejectedValue(err);
      await expect(service.requestPasswordResetToken("x@y.z")).rejects.toBe(
        err,
      );
      expect(logger.error).toHaveBeenCalledWith(
        err,
        "Error occured during password reset request",
      );
    });

    it("logs and rethrows email failures", async () => {
      users.getUserByEmail.mockResolvedValue(buildSqlUser());
      resetTokens.createResetToken.mockResolvedValue(RESET_TOKEN);
      const err = new Error("smtp down");
      emailer.sendMail.mockRejectedValue(err);
      await expect(service.requestPasswordResetToken("x@y.z")).rejects.toBe(
        err,
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("requestEmailVerification", () => {
    it("creates a validation token and emails it", async () => {
      users.getUserByEmail.mockResolvedValue(
        buildSqlUser({ email_verified: false }),
      );
      validateTokens.createValidateToken.mockResolvedValue("validate-tok");

      await service.requestEmailVerification("user@example.com");

      expect(validateTokens.createValidateToken).toHaveBeenCalledWith(USER_ID);
      expect(emailer.sendMail).toHaveBeenCalledWith({
        to: "user@example.com",
        from: config.smtpUser,
        subject: "Infinite Sudoku: Validate Email",
        html: generateValidateEmailTemplate("validate-tok", config.origin),
      });
      expect(logger.info).toHaveBeenCalled();
    });

    it("throws NotFoundError when no user is returned", async () => {
      users.getUserByEmail.mockResolvedValue(undefined as never);
      const err = await service
        .requestEmailVerification("x@y.z")
        .catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.message).toBe("User with email: x@y.z not found.");
      expect(logger.error).toHaveBeenCalledWith(
        err,
        "Error occurred sending email verification",
      );
    });

    it("throws BadRequestError when the email is already verified", async () => {
      users.getUserByEmail.mockResolvedValue(
        buildSqlUser({ email_verified: true }),
      );
      await expect(
        service.requestEmailVerification("x@y.z"),
      ).rejects.toBeInstanceOf(BadRequestError);
      expect(validateTokens.createValidateToken).not.toHaveBeenCalled();
    });

    it("rethrows email failures", async () => {
      users.getUserByEmail.mockResolvedValue(
        buildSqlUser({ email_verified: false }),
      );
      validateTokens.createValidateToken.mockResolvedValue("tok");
      emailer.sendMail.mockRejectedValue(new Error("smtp down"));
      await expect(service.requestEmailVerification("x@y.z")).rejects.toThrow(
        "smtp down",
      );
    });
  });

  describe("resetPassword", () => {
    const NOW = new Date("2026-06-01T12:00:00.000Z");
    const FIFTEEN_MINUTES = 15 * 60 * 1000;

    beforeEach(() => {
      vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const tokenCreatedAgo = (ms: number) => ({
      userId: USER_ID,
      token: RESET_TOKEN,
      createdAt: new Date(NOW.getTime() - ms),
    });

    it("changes the password and revokes all refresh tokens", async () => {
      resetTokens.consumeToken.mockResolvedValue(tokenCreatedAgo(1000));

      await service.resetPassword(RESET_TOKEN, VALID_PASSWORD);

      expect(resetTokens.consumeToken).toHaveBeenCalledWith(RESET_TOKEN);
      const [userId, hash, salt] = users.changePassword.mock.calls[0];
      expect(userId).toBe(USER_ID);
      expectHashMatches(VALID_PASSWORD, hash, salt);
      expect(refreshTokens.invalidateAllForUser).toHaveBeenCalledWith(USER_ID);
    });

    it("accepts a token exactly 15 minutes old", async () => {
      resetTokens.consumeToken.mockResolvedValue(
        tokenCreatedAgo(FIFTEEN_MINUTES),
      );
      await expect(
        service.resetPassword(RESET_TOKEN, VALID_PASSWORD),
      ).resolves.toBeUndefined();
    });

    it("rejects tokens older than 15 minutes", async () => {
      resetTokens.consumeToken.mockResolvedValue(
        tokenCreatedAgo(FIFTEEN_MINUTES + 1),
      );
      const err = await service
        .resetPassword(RESET_TOKEN, VALID_PASSWORD)
        .catch((e) => e);
      expect(err).toBeInstanceOf(AuthorizationError);
      expect(err.code).toBe(ErrorType.TOKEN_EXPIRED);
      expect(users.changePassword).not.toHaveBeenCalled();
      expect(refreshTokens.invalidateAllForUser).not.toHaveBeenCalled();
    });

    it("rejects unknown or used tokens", async () => {
      resetTokens.consumeToken.mockResolvedValue(undefined);
      const err = await service
        .resetPassword(RESET_TOKEN, VALID_PASSWORD)
        .catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.code).toBe(ErrorType.TOKEN_INVALID);
      expect(users.changePassword).not.toHaveBeenCalled();
    });

    it("does not revoke tokens if changing the password fails", async () => {
      resetTokens.consumeToken.mockResolvedValue(tokenCreatedAgo(0));
      users.changePassword.mockRejectedValue(new Error("db down"));
      await expect(
        service.resetPassword(RESET_TOKEN, VALID_PASSWORD),
      ).rejects.toThrow("db down");
      expect(refreshTokens.invalidateAllForUser).not.toHaveBeenCalled();
    });
  });

  describe("validateEmail", () => {
    it.each([true, false])("returns the data source result (%s)", async (v) => {
      validateTokens.validateEmail.mockResolvedValue(v);
      await expect(service.validateEmail("tok")).resolves.toBe(v);
      expect(validateTokens.validateEmail).toHaveBeenCalledWith("tok");
    });
  });
});
