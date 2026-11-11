import { afterEach, describe, expect, it } from "vitest";
import { Router } from "express";
import { SignJWT } from "jose";
import { createApp } from "@/app";
import { config } from "@/core/config";
import { startServer, type TestServer } from "#test/helpers/http";
import { expectLogged } from "#test/helpers/logger";

const accessToken = () =>
  new SignJWT({ role: "user", emailVerified: true })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("user-1")
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(config.jwtSecret));

function testRouter() {
  const router = Router();
  router.get("/ok", (_req, res) => {
    res.json({ ok: true });
  });
  router.get("/ip", (req, res) => {
    res.json({ ip: req.ip });
  });
  router.post("/echo", (req, res) => {
    res.json({ body: req.body, cookies: req.cookies });
  });
  router.get("/param/:id", (req, res) => {
    res.json({ id: req.params.id });
  });
  router.get("/whoami", (req, res) => {
    res.json({ sub: req.user?.sub ?? null, authError: req.authError ?? null });
  });
  router.get("/fail", () => {
    throw new Error("route exploded");
  });
  return router;
}

describe("createApp", () => {
  let server: TestServer;

  async function start({ isProduction = false } = {}) {
    const app = createApp({
      config: { ...config, isProduction },
      routers: [{ path: "/test", router: testRouter() }],
    });
    server = await startServer(app);
    return server;
  }

  afterEach(async () => {
    await server.close();
  });

  describe("routing", () => {
    it("mounts routers under /api", async () => {
      await start();
      const res = await server.get("/api/test/ok");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it("does not mount routers outside /api", async () => {
      await start();
      const res = await server.get("/test/ok");
      expect(res.status).toBe(404);
    });
  });

  describe("middleware", () => {
    it("adds a request id to successful responses", async () => {
      await start();
      const res = await server.get("/api/test/ok", {
        "x-request-id": "abc-123",
      });
      expect(res.headers.get("x-request-id")).toBe("abc-123");
    });

    it("parses JSON bodies and cookies", async () => {
      await start();
      const res = await server.post(
        "/api/test/echo",
        { a: 1 },
        { cookie: "accessToken=tok" },
      );
      expect(await res.json()).toEqual({
        body: { a: 1 },
        cookies: { accessToken: "tok" },
      });
    });

    describe("authentication", () => {
      it("sets req.user on every route when a valid token is sent", async () => {
        await start();
        const res = await server.get("/api/test/whoami", {
          authorization: `Bearer ${await accessToken()}`,
        });
        expect(await res.json()).toEqual({ sub: "user-1", authError: null });
      });

      it("reads the token from the accessToken cookie", async () => {
        await start();
        const res = await server.get("/api/test/whoami", {
          cookie: `accessToken=${await accessToken()}`,
        });
        expect((await res.json()).sub).toBe("user-1");
      });

      it("lets anonymous requests through", async () => {
        await start();
        const res = await server.get("/api/test/whoami");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ sub: null, authError: null });
      });

      it("does not block routes when the token is bad, so stale cookies can still log in", async () => {
        await start();
        const res = await server.get("/api/test/whoami", { cookie: "accessToken=garbage" });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ sub: null, authError: "token_invalid" });
      });
    });
  });

  describe("error handling", () => {
    it("responds with a JSON 404 for unknown routes", async () => {
      await start();
      const res = await server.get("/api/nope", { "x-request-id": "req-404" });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        error: "resource_not_found",
        message: "No route for GET /api/nope",
        requestId: "req-404",
      });
    });

    it("sends errors thrown by routes to the error handler", async () => {
      await start();
      const res = await server.get("/api/test/fail", {
        "x-request-id": "req-500",
      });
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({
        error: "internal_error",
        requestId: "req-500",
      });
    });

    it("logs the authenticated user's id when a route fails", async () => {
      // Goes through the real authenticate middleware, so the log reads
      // whatever shape req.user actually has rather than a hand-built one.
      await start();
      await server.get("/api/test/fail", {
        authorization: `Bearer ${await accessToken()}`,
      });
      expectLogged("error", expect.objectContaining({ userId: "user-1" }));
    });

    // The request id must be set before express.json() can reject the request.
    it("responds 400 with a request id for malformed JSON", async () => {
      await start();
      const res = await server.request("/api/test/echo", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": "req-400",
        },
        body: "{oops",
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        error: "validation_failed",
        message: "Malformed JSON body",
        requestId: "req-400",
      });
    });
  });

  describe("request errors from Express", () => {
    it("responds 413 for a JSON body over the size limit", async () => {
      await start();
      const res = await server.post("/api/test/echo", {
        a: "x".repeat(200_000),
      });
      expect(res.status).toBe(413);
      expect(await res.json()).toMatchObject({
        error: "bad_request",
        message: "request entity too large",
      });
    });

    it("responds 400 for a route param with invalid percent-encoding", async () => {
      await start();
      const res = await server.get("/api/test/param/%E0%A4%A");
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        error: "bad_request",
        message: "Malformed URL",
      });
    });
  });

  describe("outside production", () => {
    it.each(["http://localhost:5173", "http://127.0.0.1:5173"])(
      "allows credentialed CORS from the dev frontend at %s",
      async (origin) => {
        await start();
        const res = await server.get("/api/test/ok", { origin });
        expect(res.headers.get("access-control-allow-origin")).toBe(origin);
        expect(res.headers.get("access-control-allow-credentials")).toBe(
          "true",
        );
      },
    );

    it("does not allow other origins", async () => {
      await start();
      const res = await server.get("/api/test/ok", {
        origin: "http://evil.test",
      });
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("does not apply helmet or the rate limiter", async () => {
      await start();
      const res = await server.get("/api/test/ok");
      expect(res.headers.get("x-content-type-options")).toBeNull();
      expect(res.headers.get("ratelimit-policy")).toBeNull();
    });

    it("does not trust X-Forwarded-For", async () => {
      await start();
      const res = await server.get("/api/test/ip", {
        "x-forwarded-for": "9.9.9.9",
      });
      expect((await res.json()).ip).not.toBe("9.9.9.9");
    });
  });

  describe("in production", () => {
    it("only allows the configured CORS origin", async () => {
      await start({ isProduction: true });
      const res = await server.get("/api/test/ok", {
        origin: "http://evil.test",
      });
      expect(res.headers.get("access-control-allow-origin")).toBe(
        config.origin,
      );
      expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    });

    it("sets helmet security headers", async () => {
      await start({ isProduction: true });
      const res = await server.get("/api/test/ok");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("x-powered-by")).toBeNull();
    });

    it("trusts the first proxy hop", async () => {
      await start({ isProduction: true });
      const res = await server.get("/api/test/ip", {
        "x-forwarded-for": "9.9.9.9",
      });
      expect(await res.json()).toEqual({ ip: "9.9.9.9" });
    });

    it("responds 429 after 100 requests in the window", async () => {
      await start({ isProduction: true });
      for (let i = 0; i < 100; i++) {
        expect((await server.get("/api/test/ok")).status).toBe(200);
      }
      const limited = await server.get("/api/test/ok");
      expect(limited.status).toBe(429);
      expect(limited.headers.get("ratelimit-policy")).toContain("q=100");
    });
  });
});
