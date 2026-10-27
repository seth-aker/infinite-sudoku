import { beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import prexit from "prexit";

const simple = vi.fn();
const txFile = vi.fn(() => ({ simple }));
const end = vi.fn();
const begin = vi.fn(async (cb: (sql: unknown) => Promise<unknown>) =>
  cb({ file: txFile }),
);
const fakeSql = { begin, end };

vi.mock("postgres", () => ({ default: vi.fn(() => fakeSql) }));
vi.mock("prexit", () => ({ default: vi.fn() }));

async function load() {
  return (await import("@/core/dataSource/postgres")).default;
}

describe("postgres data source", () => {
  beforeEach(() => {
    vi.resetModules();
    simple.mockResolvedValue(undefined);
  });

  it("creates a client using the configured connection string", async () => {
    const sql = await load();
    expect(postgres).toHaveBeenCalledWith(process.env.DB_CONNECTION_STRING);
    expect(sql).toBe(fakeSql);
  });

  it("initializes tables from the schema file inside a transaction", async () => {
    await load();
    expect(begin).toHaveBeenCalledTimes(1);
    expect(txFile).toHaveBeenCalledWith("/root/dir/db/schema.sql");
    expect(simple).toHaveBeenCalledTimes(1);
  });

  it("throws a DatabaseError when initialization fails", async () => {
    simple.mockRejectedValueOnce(new Error("syntax error"));
    const error = await load().catch((e) => e);
    const { DatabaseError } = await import("@/core/errors/databaseError");
    expect(error).toBeInstanceOf(DatabaseError);
    expect(error.message).toBe(
      "An error occured initializing the database: Error: syntax error",
    );
  });

  it("registers a shutdown hook that ends the connection", async () => {
    await load();
    expect(prexit).toHaveBeenCalledTimes(1);
    const hook = vi.mocked(prexit).mock
      .calls[0][0] as unknown as () => Promise<void>;
    await hook();
    expect(end).toHaveBeenCalledWith({ timeout: 5 });
  });
});
