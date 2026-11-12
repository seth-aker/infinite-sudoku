import postgres, { Sql } from "postgres";
import { inject } from "vitest";

export function connect(): Sql {
  return postgres(inject("databaseUrl"), { onnotice: () => {} });
}

/**
 * Empties every table in the public schema, keeping the schema itself.
 * Looks the tables up rather than listing them, so new tables are covered.
 * CASCADE handles the foreign keys; RESTART IDENTITY resets the BIGSERIAL ids.
 */
export async function resetDb(sql: Sql) {
  const tables = await sql<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  const names = tables.map((t) => t.tablename);
  if (names.length > 0) {
    await sql`TRUNCATE ${sql(names)} RESTART IDENTITY CASCADE`;
  }
}
