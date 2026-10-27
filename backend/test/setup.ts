import { vi } from "vitest";

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

vi.mock("dotenv", () => ({ 
  default: { config: vi.fn() } 
}));
