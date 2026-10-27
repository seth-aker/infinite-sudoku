import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { WebAuthRouter } from "@/feature/auth/routing/web/webAuthRouter";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";
import { AuthorizationError } from "@/feature/auth/errors/authorizationError";
import { ConflictError } from "@/core/errors/conflictError";
import { ErrorType } from "@/core/errors/errorTypes";
import { buildApp, startServer, type TestServer } from "#test/helpers/http";
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

function cookieHeader(cookies: Record<string, string>) {
  return {
    cookie: Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; "),
  };
}

function expectAuthCookiesSet(res: Response, access: string, refresh: string) {
  const cookies = res.headers.getSetCookie();
  expect(cookies).toHaveLength(2);
  expect(cookies[0]).toMatch(new RegExp(`^accessToken=${access};`));
  expect(cookies[0]).toContain("Max-Age=900");
  expect(cookies[0]).toContain("HttpOnly");
  expect(cookies[0]).toContain("Secure");
  expect(cookies[0]).toContain("SameSite=Lax");
  expect(cookies[1]).toMatch(new RegExp(`^refreshToken=${refresh};`));
  expect(cookies[1]).toContain("Max-Age=2592000");
  expect(cookies[1]).toContain("Path=/api/auth/web/refresh");
}

function expectAuthCookiesCleared(res: Response) {
  const cookies = res.headers.getSetCookie();
  expect(cookies).toHaveLength(2);
  expect(cookies[0]).toMatch(/^accessToken=;/);
  expect(cookies[1]).toMatch(/^refreshToken=;.*Path=\/api\/auth\/web\/refresh/);
  for (const c of cookies) expect(c).toContain("Expires=Thu, 01 Jan 1970");
}

describe("WebAuthRouter", () => {
  let service: MockAuthService;
  let server: TestServer;
  let token: string;

  beforeAll(async () => {
    service = mockAuthService();
    server = await startServer(buildApp("/auth", WebAuthRouter(service)));
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
    const body = { email: "user@example.com", password: "password1" };

    it("sets auth cookies and returns the user", async () => {
      const res = await server.post("/auth/login", body);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ user: userDto });
      expect(service.verify).toHaveBeenCalledWith(body.email, body.password);
      expect(service.getNewTokenSet).toHaveBeenCalledWith(USER_ID);
      expectAuthCookiesSet(res, "access", "refresh");
      expect(limiters.auth).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["invalid email", { email: "nope", password: "password1" }],
      ["short password", { email: "a@b.co", password: "short" }],
      ["empty body", {}],
    ])("responds 400 for %s", async (_label, invalid) => {
      const res = await server.post("/auth/login", invalid);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "validation_failed" });
      expect(service.verify).not.toHaveBeenCalled();
    });

    it("responds 401 for invalid credentials without setting cookies", async () => {
      service.verify.mockRejectedValue(new AuthenticationError("bad"));
      const res = await server.post("/auth/login", body);
      expect(res.status).toBe(401);
      expect(res.headers.getSetCookie()).toEqual([]);
    });

    it("responds 403 for unverified emails", async () => {
      service.verify.mockRejectedValue(
        new AuthorizationError("unverified", {
          type: ErrorType.UNVERIFIED_EMAIL,
        }),
      );
      const res = await server.post("/auth/login", body);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: "unverified_email" });
    });
  });

  describe("POST /logout", () => {
    it("requires authentication", async () => {
      const res = await server.post("/auth/logout");
      expect(res.status).toBe(401);
    });

    it("revokes the refresh token cookie and clears cookies", async () => {
      const res = await server.post(
        "/auth/logout",
        undefined,
        cookieHeader({ accessToken: token, refreshToken: "refresh" }),
      );
      expect(res.status).toBe(204);
      expect(service.clearRefreshToken).toHaveBeenCalledWith("refresh");
      expectAuthCookiesCleared(res);
    });

    it("succeeds without a refresh token cookie", async () => {
      const res = await server.post(
        "/auth/logout",
        undefined,
        cookieHeader({ accessToken: token }),
      );
      expect(res.status).toBe(204);
      expect(service.clearRefreshToken).not.toHaveBeenCalled();
      expectAuthCookiesCleared(res);
    });
  });

  describe("POST /register", () => {
    const body = {
      email: "new@user.com",
      username: "newbie",
      password: VALID_PASSWORD,
      tosAcknowledged: true,
    };

    it("creates the user, sets cookies and responds 201", async () => {
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
      });
      expectAuthCookiesSet(res, "access", "refresh");
    });

    it("responds 400 for an invalid body", async () => {
      const res = await server.post("/auth/register", {
        ...body,
        username: "abc",
      });
      expect(res.status).toBe(400);
    });

    it("responds 500 when no user id is returned", async () => {
      service.registerUser.mockResolvedValue({
        userId: "",
        accessToken: "a",
        refreshToken: "r",
      });
      const res = await server.post("/auth/register", body);
      expect(res.status).toBe(500);
      expect(res.headers.getSetCookie()).toEqual([]);
    });

    it("responds 409 on conflicts", async () => {
      service.registerUser.mockRejectedValue(new ConflictError("dup"));
      expect((await server.post("/auth/register", body)).status).toBe(409);
    });
  });

  describe("POST /refresh", () => {
    it("responds 401 without a refresh token cookie", async () => {
      const res = await server.post("/auth/refresh");
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Refresh token required" });
      expect(service.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("ignores a refresh token in the body", async () => {
      const res = await server.post("/auth/refresh", { refreshToken: "x" });
      expect(res.status).toBe(401);
    });

    it("rotates tokens and sets new cookies", async () => {
      service.refreshAccessToken.mockResolvedValue({
        accessToken: "new-access",
        refreshToken: "new-refresh",
      });
      const res = await server.post(
        "/auth/refresh",
        undefined,
        cookieHeader({ refreshToken: "old" }),
      );
      expect(res.status).toBe(201);
      expect(service.refreshAccessToken).toHaveBeenCalledWith("old");
      expectAuthCookiesSet(res, "new-access", "new-refresh");
    });

    it("responds 401 when rotation fails", async () => {
      service.refreshAccessToken.mockRejectedValue(
        new AuthenticationError("invalid", { type: ErrorType.TOKEN_INVALID }),
      );
      const res = await server.post(
        "/auth/refresh",
        undefined,
        cookieHeader({ refreshToken: "old" }),
      );
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: "token_invalid" });
    });
  });

  describe("POST /resetPassword", () => {
    it("resets the password and clears cookies", async () => {
      service.resetPassword.mockResolvedValue(undefined);
      const res = await server.post("/auth/resetPassword", {
        token: RESET_TOKEN,
        password: VALID_PASSWORD,
      });
      expect(res.status).toBe(200);
      expect(service.resetPassword).toHaveBeenCalledWith(
        RESET_TOKEN,
        VALID_PASSWORD,
      );
      expectAuthCookiesCleared(res);
      expect(limiters.reset).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["token", { password: VALID_PASSWORD }],
      ["password", { token: RESET_TOKEN }],
      ["empty strings", { token: "", password: "" }],
    ])("rejects a body missing %s", async (_label, body) => {
      const res = await server.post("/auth/resetPassword", body);
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({
        error: ErrorType.MALFORMED_BODY,
      });
      expect(service.resetPassword).not.toHaveBeenCalled();
    });

    it("rejects requests without a body", async () => {
      const res = await server.request("/auth/resetPassword", {
        method: "POST",
      });
      expect(res.status).toBe(500);
    });
  });
});
