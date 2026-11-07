import { afterEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";
import { createApp } from "@/app";
import { config } from "@/core/config";
import { logger } from "@/core/logging/logger";
import { HealthRouter } from "@/feature/health/routing/healthRouter";
import { startServer, type TestServer } from "#test/helpers/http";

const TIMEOUT_MS = 20;

// Mimics a postgres.js query: a promise with a cancel() method.
function query(promise: Promise<unknown>) {
  return Object.assign(promise, { cancel: vi.fn() });
}

describe("HealthRouter", () => {
  const sql = vi.fn();
  let server: TestServer;

  async function start({ isProduction = false } = {}) {
    // Mounted at "/" to match composeRouters.
    const router = new HealthRouter(sql as unknown as Sql, TIMEOUT_MS).setup();
    const app = createApp({
      config: { ...config, isProduction },
      routers: [{ path: "/", router }],
    });
    server = await startServer(app);
  }

  afterEach(async () => {
    await server.close();
  });

  it("responds 200 when the database returns a timestamp", async () => {
    await start();
    sql.mockImplementationOnce(() =>
      query(Promise.resolve([{ now: new Date() }])),
    );
    const res = await server.get("/api/_health");
    expect(res.status).toBe(200);
    expect(sql.mock.calls[0][0].join("")).toContain("SELECT NOW()");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each([
    ["no timestamp", [{ now: null }]],
    ["no rows", []],
  ])("responds 503 when the database returns %s", async (_label, rows) => {
    await start();
    sql.mockImplementationOnce(() => query(Promise.resolve(rows)));
    const res = await server.get("/api/_health");
    expect(res.status).toBe(503);
  });

  it("responds 503 and logs a warning when the query fails", async () => {
    await start();
    const err = new Error("connection refused");
    sql.mockImplementationOnce(() => query(Promise.reject(err)));
    const res = await server.get("/api/_health");
    expect(res.status).toBe(503);
    expect(logger.warn).toHaveBeenCalledWith({ err }, "health check failed");
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("responds 503 and cancels the query when it hangs", async () => {
    await start();
    const hung = query(new Promise(() => {}));
    sql.mockImplementationOnce(() => hung);
    const res = await server.get("/api/_health");
    expect(res.status).toBe(503);
    expect(hung.cancel).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      { err: expect.objectContaining({ message: expect.stringContaining("timed out") }) },
      "health check failed",
    );
  });

  it("is not rate limited in production", async () => {
    await start({ isProduction: true });
    sql.mockImplementation(() => query(Promise.resolve([{ now: new Date() }])));
    for (let i = 0; i < 101; i++) {
      expect((await server.get("/api/_health")).status).toBe(200);
    }
  });
});
