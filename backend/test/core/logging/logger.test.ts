import { beforeEach, describe, expect, it, vi } from "vitest";
import pino from "pino";

vi.mock("pino", () => ({ default: vi.fn(() => ({ fake: "logger" })) }));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));

type LoggerModule = typeof import("@/core/logging/logger");

async function loadLogger() {
  return vi.importActual<LoggerModule>("@/core/logging/logger");
}

const expectedRedact = {
  paths: [
    "req.body.password",
    "req.body.refreshToken",
    "req.headers.authorization",
    "req.headers.cookie",
    "*.password",
    "*.passwordHash",
    "*.salt",
  ],
  censor: "[redacted]",
};

describe("logger", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("exports the pino instance", async () => {
    const { logger } = await loadLogger();
    expect(logger).toEqual({ fake: "logger" });
  });

  it("uses the configured log level when provided", async () => {
    vi.stubEnv("LOG_LEVEL", "warn");
    await loadLogger();
    expect(pino).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warn" }),
    );
  });

  it("defaults to debug with pretty transport outside production", async () => {
    vi.stubEnv("LOG_LEVEL", undefined);
    vi.stubEnv("NODE_ENV", "development");
    await loadLogger();
    expect(pino).toHaveBeenCalledWith({
      level: "debug",
      redact: expectedRedact,
      transport: { target: "pino-pretty" },
    });
  });

  it("defaults to info without transport in production", async () => {
    vi.stubEnv("LOG_LEVEL", undefined);
    vi.stubEnv("NODE_ENV", "production");
    await loadLogger();
    expect(pino).toHaveBeenCalledWith({
      level: "info",
      redact: expectedRedact,
    });
  });
});
