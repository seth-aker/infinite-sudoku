import dotenv from "dotenv";
import process from "node:process";
import { WorkerPoolConfig } from "../workers/workerpoolConfig";
import { fileURLToPath } from "node:url";
const DEFAULT_WORKER_PATH = fileURLToPath(
  new URL("../../feature/sudoku/puzzleSolver/puzzleGeneratorInC.ts", import.meta.url),
);
dotenv.config();

if (!process.env.DB_CONNECTION_STRING) {
  throw new Error(
    'Invalid/Missing environment variable: "DB_CONNECTION_STRING"',
  );
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("Invalid/Missing environment variable: JWT_SECRET");
}
if (!process.env.SES_ACCESS_KEY_ID) {
  throw new Error("Invalid/Missing environment variable: SES_ACCESS_KEY_ID");
}
if (!process.env.SES_SECRET_ACCESS_KEY) {
  throw new Error("Invalid/Missing environment variable: SES_SECRET_ACCESS_KEY");
}
const isProd = process.env.NODE_ENV === 'production'

export const config = {
  port: process.env.PORT || 3666,
  dbConnectionString: process.env.DB_CONNECTION_STRING,
  dbName: process.env.DB_NAME || "dev",
  origin: process.env.ORIGIN || "http://127.0.0.1:5173",
  issuer: process.env.ISSUER || "http://localhost:3666",
  audience: process.env.AUDIENCE || "http://localhost:3666",
  rootDir: process.env.ROOT_DIR || process.cwd(),
  puzzleGeneratorWorkerPath:
    process.env.WORKER_PATH || DEFAULT_WORKER_PATH,
  jwtSecret: process.env.JWT_SECRET || 'super-secret-and-long-jwt-secret',
  isProduction: isProd,
  logLevel: process.env.LOG_LEVEL,
  sesAccessKeyId: process.env.SES_ACCESS_KEY_ID,
  sesSecretAccessKey: process.env.SES_SECRET_ACCESS_KEY,
  smtpUser: process.env.SMTP_USER || 'no-reply@aker-bergeron.dev',
  etherealUser: process.env.ETHEREAL_USER || 'emerald9@ethereal.email',
  etherealPass: process.env.ETHEREAL_PASS || 'pfRS4GPAWQdGyyFcEh',
  workerPoolConfig: {
    name: "puzzleGenerator",
    workerPath: process.env.WORKER_PATH || DEFAULT_WORKER_PATH,
    options: {
      maxWorkers: 4,
      workerType: !isProd ? "process" : "thread",
      forkOpts: !isProd
        ? {
          execArgv: ["--import", "tsx"],
        }
        : undefined,
    },
  } as WorkerPoolConfig
};

export type AppConfig = typeof config;
