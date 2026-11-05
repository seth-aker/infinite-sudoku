import express, { Router } from "express";
import { config } from "./core/config";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors"
import { errorHandler } from "./core/middleware/errorHandler";
import { notFoundHandler } from "./core/middleware/notfoundHandler";
import { requestIdSetter } from "./core/middleware/requestIdSetter";
import { configureRouting } from "./core/routing";
export interface AppRouter {
  path: string,
  router: Router
}
export interface AppDeps {
  config: typeof config,
  routers: AppRouter[],
}
export function createApp({ config, routers }: AppDeps) {
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
        origin: ["*"],
        credentials: true,
      }),
    );
  }

  app.use(cookieParser());
  configureRouting(app, routers);

  // notFoundHandler and error handler should always be registered last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

