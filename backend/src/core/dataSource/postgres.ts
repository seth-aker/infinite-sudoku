import postgres from "postgres";
import { config } from "../config";
import prexit from "prexit";
import { DatabaseError } from "../errors/databaseError";
// Should this be a class to fit with the vibe of the rest of the app?
// Yes. Do I care? No.
const sql = postgres(config.dbConnectionString);

async function initTables() {
  try {
    await sql.begin(async (sql) => {
      await sql.file(`${config.rootDir}/db/schema.sql`).simple();
    });
  } catch (e) {
    throw new DatabaseError(`An error occured initializing the database: ${e}`);
  }
}

await initTables();

prexit(async () => {
  await sql.end({ timeout: 5 });
});

export default sql;
