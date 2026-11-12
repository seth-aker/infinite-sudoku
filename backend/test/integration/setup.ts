import { TestProject } from "vitest/node";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { fileURLToPath, URL } from "node:url";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string,
  }
}

const SCHEMA_URL = fileURLToPath(new URL('../../db/schema.sql', import.meta.url));

export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer("postgres:18-alpine").start();
  const sql = postgres(container.getConnectionUri(), { onnotice: () => {} });
  await sql.file(SCHEMA_URL).simple();
  await sql.end();

  project.provide("databaseUrl", container.getConnectionUri());
  return async () => {
    await container.stop();
  }
}
