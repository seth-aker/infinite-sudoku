import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { createApp } from "@/app";
import { config } from "@/core/config";
import { ErrorType } from "@/core/errors/errorTypes";
import { NotFoundError } from "@/core/errors/notFoundError";
import { UserRouter } from "@/feature/users/routing/userRouter";
import type { UserService } from "@/feature/users/service/userService";
import { startServer, type TestServer } from "#test/helpers/http";

const USER_ID = "3f0c7a4e-1b2d-4c5e-8f9a-0b1c2d3e4f5a";
const OTHER_ID = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
const SECRET = new TextEncoder().encode(config.jwtSecret);

const DTO = {
  id: USER_ID,
  email: "player@example.com",
  username: "player",
  role: "user",
};
const STATS = [
  { rating: "easy", avgScore: 1, totalStarted: 2, completed: 1, avgTimeSec: 60, totalTimeSec: 120 },
];

// Real access tokens, so the routes run through the real auth middleware.
function accessToken({ sub = USER_ID, role = "user" }: { sub?: string; role?: string } = {}) {
  return new SignJWT({ role, emailVerified: true })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(SECRET);
}

const bearer = async (opts?: Parameters<typeof accessToken>[0]) => ({
  authorization: `Bearer ${await accessToken(opts)}`,
});

describe("UserRouter", () => {
  const service = {
    getUser: vi.fn(),
    getUserStats: vi.fn(),
    deleteUser: vi.fn(),
  };
  let server: TestServer;

  beforeEach(async () => {
    service.getUser.mockResolvedValue(DTO);
    service.getUserStats.mockResolvedValue(STATS);
    const app = createApp({
      config: { ...config, isProduction: false },
      routers: [
        { path: "/users", router: new UserRouter(service as unknown as UserService).setup() },
      ],
    });
    server = await startServer(app);
  });

  afterEach(async () => {
    await server.close();
  });

  describe("GET /me", () => {
    it("returns the user from the access token's subject", async () => {
      const res = await server.get("/api/users/me", await bearer());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ user: DTO });
      expect(service.getUser).toHaveBeenCalledWith(USER_ID);
    });

    it("accepts the access token cookie", async () => {
      const res = await server.get("/api/users/me", {
        cookie: `accessToken=${await accessToken()}`,
      });
      expect(res.status).toBe(200);
    });

    it("returns 401 without an access token", async () => {
      const res = await server.get("/api/users/me");
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe(ErrorType.TOKEN_MISSING);
      expect(service.getUser).not.toHaveBeenCalled();
    });

    it("returns 404 when the user no longer exists", async () => {
      service.getUser.mockRejectedValue(new NotFoundError("gone"));
      const res = await server.get("/api/users/me", await bearer());
      expect(res.status).toBe(404);
    });
  });

  describe.each([
    ["/api/users/:id", (id: string) => `/api/users/${id}`, "getUser", { user: DTO }],
    ["/api/users/:id/stats", (id: string) => `/api/users/${id}/stats`, "getUserStats", { stats: STATS }],
  ] as const)("GET %s", (_name, path, method, body) => {
    it("returns the caller's own data", async () => {
      const res = await server.get(path(USER_ID), await bearer());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(body);
      expect(service[method]).toHaveBeenCalledWith(USER_ID);
    });

    it("lets an admin read another user's data", async () => {
      const res = await server.get(path(OTHER_ID), await bearer({ role: "admin" }));
      expect(res.status).toBe(200);
      expect(service[method]).toHaveBeenCalledWith(OTHER_ID);
    });

    it("returns 403 when a non-admin reads another user's data", async () => {
      const res = await server.get(path(OTHER_ID), await bearer());
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe(ErrorType.INSUFFICIENT_ROLE);
      expect(service[method]).not.toHaveBeenCalled();
    });

    it("returns 401 without an access token", async () => {
      const res = await server.get(path(USER_ID));
      expect(res.status).toBe(401);
      expect(service[method]).not.toHaveBeenCalled();
    });

    it("returns 400 for a non-uuid id", async () => {
      const res = await server.get(path("not-a-uuid"), await bearer());
      expect(res.status).toBe(400);
      expect(service[method]).not.toHaveBeenCalled();
    });

    it("passes NotFoundError through as a 404", async () => {
      service[method].mockRejectedValue(new NotFoundError("missing"));
      const res = await server.get(path(USER_ID), await bearer());
      expect(res.status).toBe(404);
    });
  });
});
