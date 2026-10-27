import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { MobileAuthRouter } from "@/feature/auth/routing/mobile/mobileAuthrouter";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";
import { ConflictError } from "@/core/errors/conflictError";
import { ErrorType } from "@/core/errors/errorTypes";
import {
  bearer,
  buildApp,
  startServer,
  type TestServer,
} from "#test/helpers/http";
import { mockAuthService, type MockAuthService } from "#test/helpers/mocks";
import { signAccessToken } from "#test/helpers/jwt";
import { RESET_TOKEN, USER_ID, VALID_PASSWORD } from "#test/helpers/fixtures";

const limiters = vi.hoisted(() => ({
  auth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  reset: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock("@/feature/auth/middleware/rateLimiter", () => ({
  authLimiter: () => limiters.auth,
  resetPasswordRateLimiter: limiters.reset,
}));

const userDto = {
  id: USER_ID,
  email: "user@example.com",
  username: "player",
  role: "user" as const,
};

describe("MobileAuthRouter", () => {
  let service: MockAuthService;
  let server: TestServer;
  let token: string;

  beforeAll(async () => {
    service = mockAuthService();
    server = await startServer(buildApp("/auth", MobileAuthRouter(service)));
    token = await signAccessToken({ sub: USER_ID });
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    service.verify.mockResolvedValue(userDto);
    service.getNewTokenSet.mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    });
  });

  describe("POST /login", () => {
    const body = {
      grantType: "password",
      email: "user@example.com",
      password: "secret",
    };

    it("returns tokens and the user", async () => {
      const res = await server.post("/auth/login", body);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        accessToken: "access",
        refreshToken: "refresh",
        user: userDto,
      });
      expect(service.verify).toHaveBeenCalledWith("user@example.com", "secret");
      expect(service.getNewTokenSet).toHaveBeenCalledWith(USER_ID);
      expect(res.headers.getSetCookie()).toEqual([]);
    });

    it("is rate limited", async () => {
      await server.post("/auth/login", body);
      expect(limiters.auth).toHaveBeenCalledTimes(1);
    });

    it("responds 400 for an invalid body", async () => {
      const res = await server.post("/auth/login", { email: "x" });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "validation_failed" });
      expect(service.verify).not.toHaveBeenCalled();
    });

    it("responds 400 for a malformed json body", async () => {
      const res = await server.request("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        message: "Malformed JSON body",
      });
    });

    it("responds 401 for invalid credentials", async () => {
      service.verify.mockRejectedValue(new AuthenticationError("bad"));
      const res = await server.post("/auth/login", body);
      expect(res.status).toBe(401);
      expect(service.getNewTokenSet).not.toHaveBeenCalled();
    });
  });

  describe("POST /logout", () => {
    it("requires authentication", async () => {
      const res = await server.post("/auth/logout", {});
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: "token_missing" });
    });

    it("revokes the provided refresh token and clears cookies", async () => {
      const res = await server.post(
        "/auth/logout",
        { refreshToken: "refresh" },
        bearer(token),
      );
      expect(res.status).toBe(204);
      expect(service.clearRefreshToken).toHaveBeenCalledWith("refresh");
      const cookies = res.headers.getSetCookie();
      expect(cookies).toHaveLength(2);
      expect(cookies[0]).toMatch(/^accessToken=;.*Expires=Thu, 01 Jan 1970/);
      expect(cookies[1]).toMatch(/^refreshToken=;/);
    });

    it("succeeds without a refresh token", async () => {
      const res = await server.post("/auth/logout", {}, bearer(token));
      expect(res.status).toBe(204);
      expect(service.clearRefreshToken).not.toHaveBeenCalled();
    });

    it("propagates revocation failures", async () => {
      service.clearRefreshToken.mockRejectedValueOnce(new Error("db down"));
      const res = await server.post(
        "/auth/logout",
        { refreshToken: "r" },
        bearer(token),
      );
      expect(res.status).toBe(500);
    });
  });

  describe("POST /register", () => {
    const body = {
      email: "new@user.com",
      username: "newbie",
      password: VALID_PASSWORD,
      tosAcknowledged: true,
    };

    it("creates the user and returns tokens", async () => {
      service.registerUser.mockResolvedValue({
        userId: USER_ID,
        accessToken: "access",
        refreshToken: "refresh",
      });
      const res = await server.post("/auth/register", body);
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({
        user: {
          id: USER_ID,
          email: "new@user.com",
          emailVerified: false,
          username: "newbie",
          role: "user",
        },
        accessToken: "access",
        refreshToken: "refresh",
      });
      expect(service.registerUser).toHaveBeenCalledWith(body);
    });

    it("responds 400 for a weak password", async () => {
      const res = await server.post("/auth/register", {
        ...body,
        password: "weak",
      });
      expect(res.status).toBe(400);
      expect(service.registerUser).not.toHaveBeenCalled();
    });

    it("responds 500 when no user id is returned", async () => {
      service.registerUser.mockResolvedValue({
        userId: "",
        accessToken: "a",
        refreshToken: "r",
      });
      const res = await server.post("/auth/register", body);
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({ error: "internal_error" });
    });

    it("responds 409 when the user already exists", async () => {
      service.registerUser.mockRejectedValue(new ConflictError("taken"));
      const res = await server.post("/auth/register", body);
      expect(res.status).toBe(409);
    });
  });

  describe("POST /refresh", () => {
    it("returns a rotated token set", async () => {
      service.refreshAccessToken.mockResolvedValue({
        accessToken: "new-access",
        refreshToken: "new-refresh",
      });
      const res = await server.post("/auth/refresh", {
        grantType: "refreshToken",
        refreshToken: "old",
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        accessToken: "new-access",
        refreshToken: "new-refresh",
      });
      expect(service.refreshAccessToken).toHaveBeenCalledWith("old");
    });

    it("responds 400 for an invalid body", async () => {
      const res = await server.post("/auth/refresh", {
        grantType: "refreshToken",
      });
      expect(res.status).toBe(400);
    });

    it("responds 401 TOKEN_MISSING for a password grant body", async () => {
      const res = await server.post("/auth/refresh", {
        grantType: "password",
        email: "a@b.c",
        password: "abcd",
      });
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({
        error: ErrorType.TOKEN_MISSING,
      });
      expect(service.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("responds 401 when the token cannot be rotated", async () => {
      service.refreshAccessToken.mockRejectedValue(
        new AuthenticationError("expired", { type: ErrorType.TOKEN_EXPIRED }),
      );
      const res = await server.post("/auth/refresh", {
        grantType: "refreshToken",
        refreshToken: "old",
      });
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: "token_expired" });
    });
  });

  describe("POST /resetPassword", () => {
    it("returns the token set produced by the service", async () => {
      service.resetPassword.mockResolvedValue({
        accessToken: "access",
        refreshToken: "refresh",
      } as never);
      const res = await server.post("/auth/resetPassword", {
        token: RESET_TOKEN,
        password: VALID_PASSWORD,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        accessToken: "access",
        refreshToken: "refresh",
      });
      expect(service.resetPassword).toHaveBeenCalledWith(
        RESET_TOKEN,
        VALID_PASSWORD,
      );
      expect(limiters.auth).toHaveBeenCalledTimes(1);
      expect(limiters.reset).toHaveBeenCalledTimes(1);
    });

    it("responds 500 when the service resolves without a token set", async () => {
      service.resetPassword.mockResolvedValue(undefined);
      const res = await server.post("/auth/resetPassword", {
        token: RESET_TOKEN,
        password: VALID_PASSWORD,
      });
      expect(service.resetPassword).toHaveBeenCalled();
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({ error: "internal_error" });
    });

    it.each([
      ["token", { password: VALID_PASSWORD }],
      ["password", { token: RESET_TOKEN }],
      ["both fields", {}],
    ])("rejects a body missing %s", async (_label, body) => {
      const res = await server.post("/auth/resetPassword", body);
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({
        error: ErrorType.MALFORMED_BODY,
        message: "Missing required field in request body",
      });
      expect(service.resetPassword).not.toHaveBeenCalled();
    });

    it("propagates service errors", async () => {
      service.resetPassword.mockRejectedValue(
        new AuthenticationError("bad", { type: ErrorType.TOKEN_INVALID }),
      );
      const res = await server.post("/auth/resetPassword", {
        token: RESET_TOKEN,
        password: VALID_PASSWORD,
      });
      expect(res.status).toBe(401);
    });
  });
});
