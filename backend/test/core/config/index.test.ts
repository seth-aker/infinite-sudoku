import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

// config reads process.env once, when the module is first imported, so each
// test stubs the environment and then imports a fresh copy. The base
// environment comes from `test.env` in vitest.config.ts; dotenv is mocked in
// test/setup.ts so a developer's backend/.env can't leak in.
async function loadConfig(env: Record<string, string | undefined> = {}) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.resetModules();
  const { config } = await import("@/core/config");
  return config;
}

const OPTIONAL = [
  "PORT",
  "DB_NAME",
  "ORIGIN",
  "ISSUER",
  "AUDIENCE",
  "ROOT_DIR",
  "WORKER_PATH",
  "LOG_LEVEL",
  "SMTP_USER",
  "ETHEREAL_USER",
  "ETHEREAL_PASS",
];
const unset = (names: string[]) => Object.fromEntries(names.map((n) => [n, undefined]));

describe("config", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
  });

  describe("required variables", () => {
    it.each(["DB_CONNECTION_STRING", "JWT_SECRET", "SES_ACCESS_KEY_ID", "SES_SECRET_ACCESS_KEY"])(
      "refuses to start without %s",
      async (name) => {
        await expect(loadConfig({ [name]: undefined })).rejects.toThrow(name);
      },
    );

    it.each(["DB_CONNECTION_STRING", "JWT_SECRET", "SES_ACCESS_KEY_ID", "SES_SECRET_ACCESS_KEY"])(
      "refuses to start with an empty %s",
      async (name) => {
        await expect(loadConfig({ [name]: "" })).rejects.toThrow(name);
      },
    );

    it("refuses a JWT_SECRET shorter than 32 characters", async () => {
      await expect(loadConfig({ JWT_SECRET: "x".repeat(31) })).rejects.toThrow("JWT_SECRET");
    });

    it("accepts a JWT_SECRET of exactly 32 characters", async () => {
      await expect(loadConfig({ JWT_SECRET: "x".repeat(32) })).resolves.toBeDefined();
    });
  });

  describe("values from the environment", () => {
    it("exposes the required secrets and connection string", async () => {
      const config = await loadConfig({
        DB_CONNECTION_STRING: "postgres://u:p@db:5432/sudoku",
        SES_ACCESS_KEY_ID: "key-id",
        SES_SECRET_ACCESS_KEY: "secret-key",
      });
      expect(config).toMatchObject({
        dbConnectionString: "postgres://u:p@db:5432/sudoku",
        sesAccessKeyId: "key-id",
        sesSecretAccessKey: "secret-key",
      });
    });

    it("exposes JWT_SECRET as jwtSecret", async () => {
      // Signing and verifying tokens read config.jwtSecret; if it's missing,
      // `new TextEncoder().encode(undefined)` is an empty key, which jose
      // rejects, so every login and authenticated request fails.
      const config = await loadConfig({ JWT_SECRET: "s".repeat(40) });
      expect(config).toHaveProperty("jwtSecret", "s".repeat(40));
    });

    it("uses the optional variables when set", async () => {
      const config = await loadConfig({
        PORT: "8080",
        DB_NAME: "sudoku",
        ORIGIN: "https://sudoku.example",
        ISSUER: "https://api.sudoku.example",
        AUDIENCE: "https://sudoku.example",
        ROOT_DIR: "/app",
        WORKER_PATH: "/app/dist/worker.js",
        LOG_LEVEL: "warn",
        SMTP_USER: "mail@sudoku.example",
        ETHEREAL_USER: "eu",
        ETHEREAL_PASS: "ep",
      });
      expect(config).toMatchObject({
        port: "8080",
        dbName: "sudoku",
        origin: "https://sudoku.example",
        issuer: "https://api.sudoku.example",
        audience: "https://sudoku.example",
        rootDir: "/app",
        puzzleGeneratorWorkerPath: "/app/dist/worker.js",
        logLevel: "warn",
        smtpUser: "mail@sudoku.example",
        etherealUser: "eu",
        etherealPass: "ep",
      });
      expect(config.workerPoolConfig.workerPath).toBe("/app/dist/worker.js");
    });
  });

  describe("defaults", () => {
    it("falls back to development defaults when optional variables are unset", async () => {
      const config = await loadConfig(unset(OPTIONAL));
      expect(config).toMatchObject({
        port: 3666,
        dbName: "dev",
        origin: "http://127.0.0.1:5173",
        issuer: "http://localhost:3666",
        audience: "http://localhost:3666",
        rootDir: process.cwd(),
        smtpUser: "no-reply@aker-bergeron.dev",
      });
      expect(config.logLevel).toBeUndefined();
    });

    it("defaults the worker path to the generator in this checkout", async () => {
      // Resolved from this test file, so it's correct wherever the repo lives.
      // A path written for one machine (or starting with "~", which Node
      // doesn't expand) fails this anywhere else, e.g. in CI.
      const generator = fileURLToPath(
        new URL("../../../src/feature/sudoku/puzzleSolver/puzzleGeneratorInC.ts", import.meta.url),
      );
      const config = await loadConfig(unset(["WORKER_PATH"]));
      expect(existsSync(generator)).toBe(true);
      expect(config.workerPoolConfig.workerPath).toBe(generator);
      expect(config.puzzleGeneratorWorkerPath).toBe(generator);
    });
  });

  describe("environment mode", () => {
    it("outside production, runs workers as processes that can load TypeScript", async () => {
      const config = await loadConfig({ NODE_ENV: "development" });
      expect(config).toHaveProperty("isProduction", false);
      expect(config.workerPoolConfig.options?.workerType).toBe("process");
      expect(config.workerPoolConfig.options?.forkOpts?.execArgv).toContain("tsx");
    });

    it("in production, runs workers as threads without tsx", async () => {
      const config = await loadConfig({ NODE_ENV: "production" });
      expect(config).toHaveProperty("isProduction", true);
      expect(config.workerPoolConfig.options?.workerType).toBe("thread");
      expect(config.workerPoolConfig.options?.forkOpts?.execArgv ?? []).not.toContain("tsx");
    });

    it("treats an unset NODE_ENV as not production", async () => {
      const config = await loadConfig({ NODE_ENV: undefined });
      expect(config).toHaveProperty("isProduction", false);
    });
  });
});
