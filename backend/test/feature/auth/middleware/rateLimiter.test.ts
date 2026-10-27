import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Request, type Response } from "express";
import { startServer, type TestServer } from "#test/helpers/http";

type RateLimiterModule = typeof import("@/feature/auth/middleware/rateLimiter");

const respond = (req: Request, res: Response) => {
  res.sendStatus(req.body?.succeed ? 200 : 401);
};

describe("rate limiters", () => {
  let server: TestServer;

  beforeEach(async () => {
    vi.resetModules();
    const { authLimiter, resetPasswordRateLimiter }: RateLimiterModule =
      await import("@/feature/auth/middleware/rateLimiter");
    const app = express();
    app.use(express.json());
    app.post("/login", authLimiter(), respond);
    app.post("/reset", resetPasswordRateLimiter, respond);
    server = await startServer(app);
  });

  afterEach(async () => {
    await server.close();
  });

  async function hit(path: string, body: unknown, times: number) {
    const statuses: number[] = [];
    for (let i = 0; i < times; i++) {
      statuses.push((await server.post(path, body)).status);
    }
    return statuses;
  }

  describe("authLimiter (password grant)", () => {
    const body = { grantType: "password", email: "User@Example.com" };

    it("allows 5 failed attempts then responds 429", async () => {
      expect(await hit("/login", body, 6)).toEqual([
        401, 401, 401, 401, 401, 429,
      ]);
    });

    it("sends rate limit headers", async () => {
      const res = await server.post("/login", body);
      expect(res.headers.get("x-ratelimit-limit")).toBe("5");
      expect(res.headers.get("x-ratelimit-remaining")).toBe("4");
    });

    it("does not count successful attempts", async () => {
      const ok = { ...body, succeed: true };
      expect(await hit("/login", ok, 7)).toEqual(Array(7).fill(200));
      expect(await hit("/login", body, 5)).toEqual(Array(5).fill(401));
    });

    it("keys attempts by case-insensitive email", async () => {
      await hit("/login", body, 5);
      const res = await server.post("/login", {
        ...body,
        email: "user@example.COM",
      });
      expect(res.status).toBe(429);
    });

    it("tracks different emails independently", async () => {
      await hit("/login", body, 5);
      const res = await server.post("/login", {
        ...body,
        email: "someone@else.com",
      });
      expect(res.status).toBe(401);
    });

    it("falls back to the client ip when no email is provided", async () => {
      expect(await hit("/login", { grantType: "password" }, 6)).toEqual([
        401, 401, 401, 401, 401, 429,
      ]);
      const withEmail = await server.post("/login", body);
      expect(withEmail.status).toBe(401);
    });

    it("applies to requests without a json body", async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        statuses.push(
          (await server.request("/login", { method: "POST" })).status,
        );
      }
      expect(statuses.at(-1)).toBe(429);
    });
  });

  describe("authLimiter (refresh token grant)", () => {
    const body = { grantType: "refreshToken", refreshToken: "token-a" };

    it("allows 5 failed attempts per token then responds 429", async () => {
      expect(await hit("/login", body, 6)).toEqual([
        401, 401, 401, 401, 401, 429,
      ]);
    });

    it("tracks different tokens independently", async () => {
      await hit("/login", body, 5);
      const res = await server.post("/login", {
        ...body,
        refreshToken: "token-b",
      });
      expect(res.status).toBe(401);
    });

    it("falls back to the client ip when no token is provided", async () => {
      expect(await hit("/login", { grantType: "refreshToken" }, 6)).toEqual([
        401, 401, 401, 401, 401, 429,
      ]);
    });

    it("uses a separate store from the password grant", async () => {
      await hit("/login", { grantType: "password" }, 5);
      const res = await server.post("/login", { grantType: "refreshToken" });
      expect(res.status).toBe(401);
    });
  });

  describe("resetPasswordRateLimiter", () => {
    const body = { email: "User@Example.com" };

    it("allows 3 failed attempts then responds 429", async () => {
      expect(await hit("/reset", body, 4)).toEqual([401, 401, 401, 429]);
    });

    it("keys attempts by case-insensitive email", async () => {
      await hit("/reset", body, 3);
      const res = await server.post("/reset", { email: "USER@example.com" });
      expect(res.status).toBe(429);
    });

    it("falls back to the client ip when no email is provided", async () => {
      expect(await hit("/reset", {}, 4)).toEqual([401, 401, 401, 429]);
      expect((await server.post("/reset", body)).status).toBe(401);
    });

    it("does not count successful attempts", async () => {
      expect(await hit("/reset", { ...body, succeed: true }, 5)).toEqual(
        Array(5).fill(200),
      );
    });
  });
});
