import { vi, type Mock } from "vitest";
import type { Sql } from "postgres";

export interface SqlCall {
  query: string;
  values: unknown[];
}

export type QueryResult<T = unknown> = T[] & { count: number };

export function result<T>(rows: T[] = [], count = rows.length): QueryResult<T> {
  return Object.assign([...rows], { count });
}

export interface SqlMock {
  sql: Sql;
  tag: Mock;
  begin: Mock;
  calls: SqlCall[];
  executedCalls: SqlCall[];
  enqueue: (...values: unknown[]) => void;
}

export function createSqlMock(): SqlMock {
  const calls: SqlCall[] = [];
  const executedCalls: SqlCall[] = [];
  const queue: unknown[] = [];

  const dequeue = (call: SqlCall) => {
    executedCalls.push(call);
    const next = queue.length > 0 ? queue.shift() : result();
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };

  const tag = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const call: SqlCall = {
      query: strings.join("$").replace(/\s+/g, " ").trim(),
      values,
    };
    calls.push(call);
    let pending: Promise<unknown> | undefined;
    const run = () => (pending ??= dequeue(call));
    return {
      call,
      then: (onFulfilled?: never, onRejected?: never) =>
        run().then(onFulfilled, onRejected),
      catch: (onRejected?: never) => run().catch(onRejected),
      execute: () => run(),
    };
  });

  const begin = vi.fn(async (cb: (sql: unknown) => unknown) => cb(tag));
  Object.assign(tag, { begin });

  return {
    sql: tag as unknown as Sql,
    tag,
    begin,
    calls,
    executedCalls,
    enqueue: (...values: unknown[]) => queue.push(...values),
  };
}
