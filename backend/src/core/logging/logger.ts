import pino from "pino";
import { config } from "@/core/config/index.ts";

export const logger = pino({
  level: config.logLevel ?? (config.isProduction ? "info" : "debug"),
  redact: {
    paths: [
      "req.body.password",
      "req.body.refreshToken",
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.salt",
    ],
    censor: "[redacted]",
  },
  ...(config.isProduction ? {} : { transport: { target: "pino-pretty" } }),
});
