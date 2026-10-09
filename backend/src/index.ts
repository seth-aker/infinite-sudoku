import express from "express";
import { configureRouting } from "./core/routing/index";
import { config } from "./core/config/index";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import prexit from "prexit";
import cookieParser from "cookie-parser";
import { notFoundHandler } from "./core/middleware/notfoundHandler";
import { errorHandler } from "./core/middleware/errorHandler";
import { requestIdSetter } from "./core/middleware/requestIdSetter";
import { logger } from "./core/logging/logger";
const app = express();
app.use(requestIdSetter); // should always be registered first

app.use(express.json());

if (config.isProduction) {
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin: config.origin,
      credentials: true,
    }),
  );
  app.use(helmet());
  app.use(
    rateLimit({
      windowMs: 10 * 60 * 1000, // 10 minute window
      limit: 100,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
} else {
  app.use(
    cors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
    }),
  );
}

app.use(cookieParser());
configureRouting(app);

// notFoundHandler and error handler should always be registered last.
app.use(notFoundHandler);
app.use(errorHandler);

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
