import { vi, type Mock } from "vitest";
import type { Sql } from "postgres";

export interface RecordedQuery {
  /** The query text with each parameter replaced by `$`, whitespace collapsed. */
  text: string;
  values: unknown[];
}

type QueuedResult = { rows: unknown[]; count?: number } | Error;

const FRAGMENT = Symbol("fake sql query");

interface FakeQuery extends PromiseLike<unknown> {
  [FRAGMENT]: { strings: readonly string[]; values: unknown[] };
}

const isFakeQuery = (value: unknown): value is FakeQuery =>
  typeof value === "object" && value !== null && FRAGMENT in value;

const HELPER = Symbol("fake sql helper");

/** What `sql(value, ...columns)` (e.g. a multi-row insert) recorded. */
export interface HelperCall {
  value: unknown;
  columns: unknown[];
}

interface FakeHelper {
  [HELPER]: HelperCall;
}

const isFakeHelper = (value: unknown): value is FakeHelper =>
  typeof value === "object" && value !== null && HELPER in value;

const isTemplate = (value: unknown): value is TemplateStringsArray =>
  Array.isArray(value) && "raw" in value;

/** Joins a template into text, inlining any nested queries used as fragments. */
function flatten(strings: readonly string[], values: unknown[]): RecordedQuery {
  let text = strings[0] ?? "";
  const flat: unknown[] = [];
  values.forEach((value, i) => {
    if (isFakeQuery(value)) {
      const inner = flatten(value[FRAGMENT].strings, value[FRAGMENT].values);
      text += inner.text;
      flat.push(...inner.values);
    } else if (isFakeHelper(value)) {
      // Recorded whole, so tests can check the rows/columns passed in.
      text += "${helper}";
      flat.push(value[HELPER]);
    } else {
      text += "$";
      flat.push(value);
    }
    text += strings[i + 1] ?? "";
  });
  return { text: text.replace(/\s+/g, " ").trim(), values: flat };
}

/**
 * A stand-in for the postgres.js `sql` tagged template, for unit testing the
 * logic around queries rather than the SQL itself.
 *
 * Like postgres.js, a query only runs when it is awaited, so a query used as
 * a fragment inside another (`sql\`... ${sql\`AND x = ${y}\`}\``) is inlined
 * into the outer query's text and values rather than run on its own.
 * Helper calls (`sql(rows, ...columns)`) appear in the text as `${helper}`
 * and in the values as a `HelperCall`.
 *
 * Queue a result per executed query with `returns(rows, count?)` /
 * `fails(err)`; queries with nothing queued resolve to no rows. Results are
 * arrays with a `count`, like postgres.js. `begin(cb)` runs `cb` with the same
 * fake.
 */
export function fakeSql() {
  const queue: QueuedResult[] = [];
  const queries: RecordedQuery[] = [];

  const tag = vi.fn((strings: unknown, ...values: unknown[]): FakeQuery | FakeHelper => {
    if (!isTemplate(strings)) return { [HELPER]: { value: strings, columns: values } };
    let result: Promise<unknown> | undefined;
    const run = () => {
      result ??= (() => {
        queries.push(flatten(strings, values));
        const next = queue.shift() ?? { rows: [] };
        if (next instanceof Error) return Promise.reject(next);
        return Promise.resolve(
          Object.assign([...next.rows], { count: next.count ?? next.rows.length }),
        );
      })();
      return result;
    };
    return {
      [FRAGMENT]: { strings, values },
      then: (onFulfilled, onRejected) => run().then(onFulfilled, onRejected),
    };
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
