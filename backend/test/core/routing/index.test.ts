import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express, { Router } from "express";
import { configureRouting } from "@/core/routing/index";
import { notFoundHandler } from "@/core/middleware/notfoundHandler";
import { errorHandler } from "@/core/middleware/errorHandler";
import { startServer, type TestServer } from "#test/helpers/http";

const { sqlTag } = vi.hoisted(() => ({ sqlTag: vi.fn() }));

function stubRouter(name: string) {
  const router = Router();
  router.get("/ping", (_req, res) => {
    res.json({ router: name });
  });
  return router;
}

vi.mock("@/core/dataSource/postgres", () => ({ default: sqlTag }));
vi.mock("@/feature/sudoku/routing/index", () => ({
  sudokuRouter: stubRouter("sudoku"),
}));
vi.mock("@/feature/users/routing", () => ({
  userRouter: stubRouter("users"),
}));
vi.mock("@/feature/auth/routing/authRouter", () => ({
  authRouter: stubRouter("auth"),
}));

describe("configureRouting", () => {
  let server: TestServer;

  beforeEach(async () => {
    const app = express();
    configureRouting(app);
    app.use(notFoundHandler);
    app.use(errorHandler);
    server = await startServer(app);
  });

  afterEach(async () => {
    await server.close();
  });

  it.each(["sudoku", "auth", "users"])(
    "mounts the %s router under /api",
    async (name) => {
      const res = await server.get(`/api/${name}/ping`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ router: name });
    },
  );

  it("does not mount routers outside /api", async () => {
    const res = await server.get("/sudoku/ping");
    expect(res.status).toBe(404);
  });

  describe("GET /api/_health", () => {
    it("returns 200 when the database responds", async () => {
      sqlTag.mockResolvedValueOnce([{ now: new Date() }]);
      const res = await server.get("/api/_health");
      expect(res.status).toBe(200);
      expect(sqlTag.mock.calls[0][0].join("")).toContain("SELECT NOW()");
    });

    it("returns 500 when the database returns no timestamp", async () => {
      sqlTag.mockResolvedValueOnce([{ now: null }]);
      const res = await server.get("/api/_health");
      expect(res.status).toBe(500);
    });

    it("returns 500 through the error handler when the query fails", async () => {
      sqlTag.mockRejectedValueOnce(new Error("connection refused"));
      const res = await server.get("/api/_health");
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({ error: "internal_error" });
    });
  });
});
