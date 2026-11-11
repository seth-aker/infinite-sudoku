import { expect, vi } from "vitest";
import { logger } from "@/core/logging/logger";

type Level = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/**
 * Asserts something was logged at `level` whose first argument (pino's context
 * object, or the error itself) matches `first`. The message text is ignored,
 * so rewording a log line doesn't break tests. Pass
 * `expect.objectContaining({...})` to check only the fields that matter.
 */
export function expectLogged(level: Level, first: unknown = expect.anything()) {
  const firstArgs = vi.mocked(logger[level]).mock.calls.map((call) => call[0]);
  expect(firstArgs).toContainEqual(first);
}
