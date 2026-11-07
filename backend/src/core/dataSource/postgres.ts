import postgres, { Sql } from "postgres";
import prexit from "prexit";
import { DatabaseError } from "../errors/databaseError";
import { AppConfig } from "../config";

async function initTables(sql: Sql, config: AppConfig) {
  try {
    await sql.begin(async (transaction) => {
      await transaction.file(`${config.rootDir}/db/schema.sql`).simple();
    });
  } catch (e) {
    throw new DatabaseError(`An error occured initializing the database: ${e}`);
  }
}

export async function setupDataSource(config: AppConfig) {
  const sql = postgres(config.dbConnectionString);

  await initTables(sql, config);

  prexit(async () => {
    await sql.end({ timeout: 5 });
  });
  return sql;
}
