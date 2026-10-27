import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));

async function loadConfig() {
  const mod = await import("@/core/config/index");
  return mod.config;
}

describe("config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("loads environment variables via dotenv", async () => {
    const dotenv = (await import("dotenv")).default;
    await loadConfig();
    expect(dotenv.config).toHaveBeenCalled();
  });

  it("reads values from the environment", async () => {
    vi.stubEnv("PORT", "8080");
    vi.stubEnv("DB_NAME", "prod");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STMP_USER", "mailer@test");
    const config = await loadConfig();
    expect(config).toEqual({
      port: "8080",
      dbConnectionString: process.env.DB_CONNECTION_STRING,
      dbName: "prod",
      origin: "http://origin.test",
      issuer: "http://issuer.test",
      audience: "http://audience.test",
      rootDir: "/root/dir",
      puzzleGeneratorWorkerPath: "/worker/path.ts",
      jwtSecret: process.env.JWT_SECRET,
      isProduction: true,
      logLevel: "silent",
      sesAccessKeyId: process.env.SES_ACCESS_KEY_ID,
      sesSecretAccessKey: process.env.SES_SECRET_ACCESS_KEY,
      smtpUser: "mailer@test",
    });
  });

  it("falls back to defaults for optional variables", async () => {
    for (const key of [
      "PORT",
      "DB_NAME",
      "ORIGIN",
      "ISSUER",
      "AUDIENCE",
      "ROOT_DIR",
      "WORKER_PATH",
      "LOG_LEVEL",
      "STMP_USER",
    ]) {
      vi.stubEnv(key, undefined);
    }
    vi.stubEnv("NODE_ENV", "development");
    const config = await loadConfig();
    expect(config.port).toBe(3666);
    expect(config.dbName).toBe("dev");
    expect(config.origin).toBe("http://127.0.0.1:5173");
    expect(config.issuer).toBe("http://localhost:3666");
    expect(config.audience).toBe("http://localhost:3666");
    expect(config.rootDir).toBe(process.cwd());
    expect(config.puzzleGeneratorWorkerPath).toMatch(
      /src\/feature\/sudoku\/puzzleSolver\/puzzleGeneratorInC\.ts$/,
    );
    expect(config.isProduction).toBe(false);
    expect(config.logLevel).toBeUndefined();
    expect(config.smtpUser).toBe("no-reply@aker-bergeron.dev");
  });

  it.each([
    [
      "DB_CONNECTION_STRING",
      'Invalid/Missing environment variable: "DB_CONNECTION_STRING"',
    ],
    ["JWT_SECRET", "Invalid/Missing environment variable: JWT_SECRET"],
    [
      "SES_ACCESS_KEY_ID",
      "Invalid/Missing environment variable: SES_ACCESS_KEY_ID",
    ],
    [
      "SES_SECRET_ACCESS_KEY",
      "Invalid/Missing environment variable: SES_SECRET_ACCESS_KEY",
    ],
  ])("throws when %s is missing", async (key, message) => {
    vi.stubEnv(key, undefined);
    await expect(loadConfig()).rejects.toThrow(message);
  });

  it("treats an empty required variable as missing", async () => {
    vi.stubEnv("JWT_SECRET", "");
    await expect(loadConfig()).rejects.toThrow("JWT_SECRET");
  });
});
