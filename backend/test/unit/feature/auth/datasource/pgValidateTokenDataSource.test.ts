import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PgValidateTokenDataSource } from "@/feature/auth/datasource/pgValidateTokenDataSource";
import { fakeSql } from "#test/helpers/sql";
import { expectLogged } from "#test/helpers/logger";

// Only the sweep timer is tested here; what the queries do is covered against
// a real database in test/integration/feature/auth/datasource/pgValidateTokenDataSource.test.ts.
// Matches the interval in the source; change both together.
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

describe("PgValidateTokenDataSource expired token sweep", () => {
  let db: ReturnType<typeof fakeSql>;
  let source: PgValidateTokenDataSource;

  beforeEach(() => {
    vi.useFakeTimers();
    db = fakeSql();
    PgValidateTokenDataSource.instance = null;
    source = PgValidateTokenDataSource.create(db.sql);
  });

  afterEach(() => {
    source.close();
    vi.useRealTimers();
  });

  it("returns the same instance on later create calls", () => {
    expect(PgValidateTokenDataSource.create(fakeSql().sql)).toBe(source);
  });

  it("runs on its interval", async () => {
    await vi.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS - 1);
    expect(db.queries).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(db.queries).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expect(db.queries).toHaveLength(2);
  });

  it("logs and keeps running when a sweep fails", async () => {
    const err = new Error("db down");
    db.fails(err);
    await vi.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expectLogged("error", expect.objectContaining({ err }));
    await vi.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expect(db.queries).toHaveLength(2);
  });

  it("stops after close()", async () => {
    source.close();
    await vi.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS * 2);
    expect(db.queries).toHaveLength(0);
  });

  it("does not keep the process alive", () => {
    // The sweep timer is unref'd so it never blocks shutdown.
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    PgValidateTokenDataSource.instance = null;
    const fresh = PgValidateTokenDataSource.create(fakeSql().sql);
    const timer = setIntervalSpy.mock.results[0]!.value as NodeJS.Timeout;
    expect(timer.hasRef()).toBe(false);
    fresh.close();
  });
});
