import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PgRefreshTokenDataSource } from "@/feature/auth/datasource/pgRefreshTokenDataSource";
import { fakeSql } from "#test/helpers/sql";
import { expectLogged } from "#test/helpers/logger";

// Only the sweep timer is tested here; what the queries do is covered against
// a real database in test/integration/feature/auth/datasource/pgRefreshTokenDataSource.test.ts.
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

describe("PgRefreshTokenDataSource expired token sweep", () => {
  let db: ReturnType<typeof fakeSql>;
  let source: PgRefreshTokenDataSource;

  beforeEach(() => {
    vi.useFakeTimers();
    db = fakeSql();
    PgRefreshTokenDataSource.instance = null;
    source = PgRefreshTokenDataSource.create(db.sql);
  });

  afterEach(() => {
    source.close();
    vi.useRealTimers();
  });

  it("returns the same instance on later create calls", () => {
    expect(PgRefreshTokenDataSource.create(fakeSql().sql)).toBe(source);
  });

  it("runs every 15 minutes", async () => {
    await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES_MS - 1);
    expect(db.queries).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(db.queries).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES_MS);
    expect(db.queries).toHaveLength(2);
  });

  it("logs and keeps running when a sweep fails", async () => {
    const err = new Error("db down");
    db.fails(err);
    await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES_MS);
    expectLogged("error", expect.objectContaining({ err }));
    await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES_MS);
    expect(db.queries).toHaveLength(2);
  });

  it("stops after close()", async () => {
    source.close();
    await vi.advanceTimersByTimeAsync(FIFTEEN_MINUTES_MS * 2);
    expect(db.queries).toHaveLength(0);
  });

  it("does not keep the process alive", () => {
    // The sweep timer is unref'd so it never blocks shutdown.
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    PgRefreshTokenDataSource.instance = null;
    const fresh = PgRefreshTokenDataSource.create(fakeSql().sql);
    const timer = setIntervalSpy.mock.results[0]!.value as NodeJS.Timeout;
    expect(timer.hasRef()).toBe(false);
    fresh.close();
  });
});
