import postgres from "postgres";
import { config } from "../config";
import prexit from "prexit";
const sql = postgres(config.dbConnectionString)

prexit(async () => {
  await sql.end({timeout: 5})
  
})

export default sql
