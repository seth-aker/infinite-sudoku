import postgres from "postgres";
import prexit from "prexit";
import { AppConfig } from "../config";

export async function setupDataSource(config: AppConfig) {
  const sql = postgres(config.dbConnectionString);

  prexit(async () => {
    await sql.end({ timeout: 5 });
  });
  return sql;
}
