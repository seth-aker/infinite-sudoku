import { vi } from "vitest";

// Runs before every test file (see `setupFiles` in vitest.config.ts).

// Keep test output quiet and avoid starting the pino-pretty transport worker.
vi.mock("@/core/logging/logger", () => ({
  logger: {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

// Stop `core/config` from loading the developer's real backend/.env, so tests
// only see the values from `test.env` in vitest.config.ts.
vi.mock("dotenv", () => ({
  default: { config: vi.fn() },
}));
