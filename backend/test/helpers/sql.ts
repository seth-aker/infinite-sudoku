import { vi, type Mock } from "vitest";
import type { Sql } from "postgres";

export interface RecordedQuery {
  /** The query text with each parameter replaced by `$`. */
  text: string;
  values: unknown[];
}

type QueuedResult = { rows: unknown[]; count?: number } | Error;

/**
 * A stand-in for the postgres.js `sql` tagged template, for unit testing the
 * logic around queries rather than the SQL itself.
 *
 * Queue a result per query with `returns(rows)` / `fails(err)`; queries with
 * nothing queued resolve to no rows. Results are arrays with a `count`, like
 * postgres.js. `begin(cb)` runs `cb` with the same fake.
 */
export function fakeSql() {
  const queue: QueuedResult[] = [];
  const queries: RecordedQuery[] = [];

  const tag = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    queries.push({ text: strings.join("$").replace(/\s+/g, " ").trim(), values });
    const next = queue.shift() ?? { rows: [] };
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(Object.assign([...next.rows], { count: next.count ?? next.rows.length }));
  }) as Mock & { begin: Mock };
  tag.begin = vi.fn(async (cb: (sql: unknown) => unknown) => cb(tag));

  return {
    sql: tag as unknown as Sql,
    tag,
    queries,
    returns(rows: unknown[], count?: number) {
      queue.push({ rows, count });
      return this;
    },
    fails(err: Error) {
      queue.push(err);
      return this;
    },
  };
}
