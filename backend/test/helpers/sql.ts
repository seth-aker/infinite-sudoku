import { vi, type Mock } from "vitest";
import type { Sql } from "postgres";

export interface RecordedQuery {
  /** The query text with each parameter replaced by `$`, whitespace collapsed. */
  text: string;
  values: unknown[];
}

type QueuedResult = { rows: unknown[]; count?: number } | Error;

/**
 * A minimal stand-in for the postgres.js `sql` tagged template, for unit tests
 * that only care whether and when a query runs (e.g. the token sweep timers),
 * not what it does. Anything that depends on the SQL itself belongs in the
 * integration tests, against a real database.
 *
 * Queue a result per query with `returns(rows, count?)` / `fails(err)`;
 * queries with nothing queued resolve to no rows.
 */
export function fakeSql() {
  const queue: QueuedResult[] = [];
  const queries: RecordedQuery[] = [];

  const tag: Mock = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    queries.push({ text: strings.join("$").replace(/\s+/g, " ").trim(), values });
    const next = queue.shift() ?? { rows: [] };
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(Object.assign([...next.rows], { count: next.count ?? next.rows.length }));
  });

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
