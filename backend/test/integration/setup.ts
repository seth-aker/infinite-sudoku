import { TestProject } from "vitest/node";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { fileURLToPath, URL } from "node:url";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string,
  }
}

// backend/db holds migrate.sh and migrations/. It is copied to /db, the same
// path docker-compose mounts it at, so the production script runs unchanged.
const DB_DIR = fileURLToPath(new URL('../../db', import.meta.url));

export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer("postgres:18-alpine")
    .withCopyDirectoriesToContainer([{ source: DB_DIR, target: "/db" }])
    .start();

  // Run the real migration runner over the local socket, so the test schema
  // matches what docker-compose's db-migrate service produces.
  const result = await container.exec(["sh", "/db/migrate.sh"], {
    env: {
      PGUSER: container.getUsername(),
      PGPASSWORD: container.getPassword(),
      PGDATABASE: container.getDatabase(),
      BACKUP_DIR: "/tmp",
    },
  });
  if (result.exitCode !== 0) {
    await container.stop();
    throw new Error(`db migrations failed (exit ${result.exitCode}):\n${result.output}`);
  }

  project.provide("databaseUrl", container.getConnectionUri());
  return async () => {
    await container.stop();
  }
}
