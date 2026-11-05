import { config } from "./core/config/index";
import prexit from "prexit";
import { logger } from "./core/logging/logger";
import { createApp } from "./app";
import { composeRouters } from "./compose";
import { setupDataSource } from "./core/dataSource/postgres";

const sql = await setupDataSource(config);
const routers = await composeRouters(sql, config);
const app = createApp({ config, routers })

const server = app.listen(config.port, () => {
  console.log("Sudoku app listening at:", config.port);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandled rejection — promoting to exception");
  throw reason instanceof Error ? reason : new Error(String(reason));
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception — shutting down");
  server.close(() => process.exit(1));
  setTimeout(() => process.exit(1), 10_000).unref();
});

prexit(async () => {
  await new Promise((r) => server.close(r));
});
