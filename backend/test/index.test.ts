import { afterEach, describe, expect, it, vi } from "vitest";
import { Server } from "node:http";
import { once } from "node:events";
import type { Application } from "express";
import prexit from "prexit";
import { logger } from "@/core/logging/logger";
import { wrapServer, type TestServer } from "#test/helpers/http";

vi.mock("prexit", () => ({ default: vi.fn() }));
vi.mock("@/core/routing/index", () => ({
  configureRouting: (app: Application) => {
    app.get("/api/ok", (_req, res) => {
      res.json({ ok: true });
    });
    app.get("/api/ip", (req, res) => {
      res.json({ ip: req.ip });
    });
    app.post("/api/echo", (req, res) => {
      res.json({ body: req.body, cookies: req.cookies });
    });
    app.get("/api/fail", () => {
      throw new Error("route exploded");
    });
  },
}));

type Handler = (arg: unknown) => void;

interface Booted {
  server: TestServer;
  handlers: Map<string, Handler>;
}

let booted: Booted | undefined;

async function boot(nodeEnv: string): Promise<Booted> {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  const handlers = new Map<string, Handler>();
  const onSpy = vi.spyOn(process, "on").mockImplementation(((
    event: string,
    fn: Handler,
  ) => {
    handlers.set(event, fn);
    return process;
  }) as typeof process.on);
  const listenSpy = vi.spyOn(Server.prototype, "listen");
  vi.spyOn(console, "log").mockImplementation(() => {});

  await import("@/index");

  const server = listenSpy.mock.contexts[0] as Server;
  onSpy.mockRestore();
  listenSpy.mockRestore();
  if (!server.listening) await once(server, "listening");
  await new Promise((resolve) => setImmediate(resolve));
  booted = { server: wrapServer(server), handlers };
  return booted;
}

afterEach(async () => {
  if (booted?.server.server.listening) await booted.server.close();
  booted = undefined;
});

describe("app bootstrap (index.ts)", () => {
  describe("in development", () => {
    it("listens on the configured port and logs it", async () => {
      const { server } = await boot("development");
      expect(server.server.listening).toBe(true);
      expect(console.log).toHaveBeenCalledWith("Sudoku app listening at:", "0");
    });

    it("serves routes configured by configureRouting", async () => {
      const { server } = await boot("development");
      const res = await server.get("/api/ok");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it("sets a request id on every response", async () => {
      const { server } = await boot("development");
      const res = await server.get("/api/ok", { "x-request-id": "abc-123" });
      expect(res.headers.get("x-request-id")).toBe("abc-123");
    });

    it("parses json bodies and cookies", async () => {
      const { server } = await boot("development");
      const res = await server.post(
        "/api/echo",
        { a: 1 },
        { cookie: "accessToken=tok" },
      );
      expect(await res.json()).toEqual({
        body: { a: 1 },
        cookies: { accessToken: "tok" },
      });
    });

    it("responds 400 for malformed json", async () => {
      const { server } = await boot("development");
      const res = await server.request("/api/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{oops",
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        error: "validation_failed",
        message: "Malformed JSON body",
      });
    });

    it("responds 404 json for unknown routes", async () => {
      const { server } = await boot("development");
      const res = await server.get("/nope", { "x-request-id": "req-404" });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        error: "resource_not_found",
        message: "No route for GET /nope",
        requestId: "req-404",
      });
    });

    it("handles route errors with the error handler and exposes details", async () => {
      const { server } = await boot("development");
      const res = await server.get("/api/fail");
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({ message: "route exploded" });
    });

    it.each(["http://localhost:5173", "http://127.0.0.1:5173"])(
      "allows credentialed CORS from %s",
      async (origin) => {
        const { server } = await boot("development");
        const res = await server.get("/api/ok", { origin });
        expect(res.headers.get("access-control-allow-origin")).toBe(origin);
        expect(res.headers.get("access-control-allow-credentials")).toBe(
          "true",
        );
      },
    );

    it("does not allow other origins", async () => {
      const { server } = await boot("development");
      const res = await server.get("/api/ok", { origin: "http://evil.test" });
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("does not apply production hardening", async () => {
      const { server } = await boot("development");
      const res = await server.get("/api/ip", {
        "x-forwarded-for": "9.9.9.9",
      });
      expect(res.headers.get("x-content-type-options")).toBeNull();
      expect(res.headers.get("ratelimit-policy")).toBeNull();
      expect((await res.json()).ip).not.toBe("9.9.9.9");
    });
  });

  describe("in production", () => {
    it("only allows the configured origin", async () => {
      const { server } = await boot("production");
      const allowed = await server.get("/api/ok", {
        origin: "http://origin.test",
      });
      expect(allowed.headers.get("access-control-allow-origin")).toBe(
        "http://origin.test",
      );
      expect(allowed.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );
      const local = await server.get("/api/ok", {
        origin: "http://localhost:5173",
      });
      expect(local.headers.get("access-control-allow-origin")).toBe(
        "http://origin.test",
      );
    });

    it("sets helmet security headers", async () => {
      const { server } = await boot("production");
      const res = await server.get("/api/ok");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("x-powered-by")).toBeNull();
    });

    it("applies a global rate limit with draft-8 headers", async () => {
      const { server } = await boot("production");
      const res = await server.get("/api/ok");
      expect(res.headers.get("ratelimit-policy")).toContain("q=100");
      expect(res.headers.get("x-ratelimit-limit")).toBeNull();
    });

    it("responds 429 after 100 requests in the window", async () => {
      const { server } = await boot("production");
      for (let i = 0; i < 100; i++) {
        expect((await server.get("/api/ok")).status).toBe(200);
      }
      expect((await server.get("/api/ok")).status).toBe(429);
    });

    it("trusts the first proxy hop", async () => {
      const { server } = await boot("production");
      const res = await server.get("/api/ip", {
        "x-forwarded-for": "9.9.9.9",
      });
      expect(await res.json()).toEqual({ ip: "9.9.9.9" });
    });

    it("hides internal error details", async () => {
      const { server } = await boot("production");
      const res = await server.get("/api/fail");
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({
        error: "internal_error",
        message: "An unexpected error occurred",
      });
    });
  });

  describe("process handlers", () => {
    it("promotes unhandled rejections with Error reasons", async () => {
      const { handlers } = await boot("development");
      const reason = new Error("rejected");
      expect(() => handlers.get("unhandledRejection")!(reason)).toThrow(reason);
      expect(logger.error).toHaveBeenCalledWith(
        { err: reason },
        "unhandled rejection — promoting to exception",
      );
    });

    it("wraps non-Error rejection reasons", async () => {
      const { handlers } = await boot("development");
      let thrown: unknown;
      try {
        handlers.get("unhandledRejection")!("plain reason");
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe("plain reason");
    });

    it("shuts down on uncaught exceptions", async () => {
      const { handlers, server } = await boot("development");
      const exit = vi
        .spyOn(process, "exit")
        .mockImplementation((() => undefined) as never);
      const unref = vi.fn();
      const timeout = vi
        .spyOn(globalThis, "setTimeout")
        .mockReturnValue({ unref } as never);
      const err = new Error("fatal");

      handlers.get("uncaughtException")!(err);

      expect(logger.fatal).toHaveBeenCalledWith(
        { err },
        "uncaught exception — shutting down",
      );
      expect(timeout).toHaveBeenCalledWith(expect.any(Function), 10_000);
      expect(unref).toHaveBeenCalled();
      const forceExit = timeout.mock.calls[0][0] as () => void;
      timeout.mockRestore();

      await once(server.server, "close");
      expect(exit).toHaveBeenCalledWith(1);

      exit.mockClear();
      forceExit();
      expect(exit).toHaveBeenCalledWith(1);
    });

    it("closes the server on process exit via prexit", async () => {
      const { server } = await boot("development");
      const hook = vi
        .mocked(prexit)
        .mock.calls.at(-1)![0] as unknown as () => Promise<void>;
      server.server.closeAllConnections();
      await hook();
      expect(server.server.listening).toBe(false);
    });
  });
});
