import dotenv from "dotenv";
import process from "node:process";
dotenv.config();

if (!process.env.DB_CONNECTION_STRING) {
  throw new Error(
    'Invalid/Missing environment variable: "DB_CONNECTION_STRING"',
  );
}
if (!process.env.JWT_SECRET) {
  throw new Error("Invalid/Missing environment variable: JWT_SECRET");
}
if (!process.env.SES_ACCESS_KEY_ID) {
  throw new Error("Invalid/Missing environment variable: SES_ACCESS_KEY_ID");
}
if(!process.env.SES_SECRET_ACCESS_KEY) {
  throw new Error("Invalid/Missing environment variable: SES_SECRET_ACCESS_KEY");
}

export const config = {
  port: process.env.PORT || 3666,
  dbConnectionString: process.env.DB_CONNECTION_STRING,
  dbName: process.env.DB_NAME || "dev",
  origin: process.env.ORIGIN || "http://127.0.0.1:5173",
  issuer: process.env.ISSUER || "http://localhost:3666",
  audience: process.env.AUDIENCE || "http://localhost:3666",
  rootDir: process.env.ROOT_DIR || process.cwd(),
  puzzleGeneratorWorkerPath:
    process.env.WORKER_PATH ||
    "/home/saker/workspace/vue-sudoku/backend/src/feature/sudoku/puzzleSolver/puzzleGeneratorInC.ts",
  jwtSecret: process.env.JWT_SECRET,
  isProduction: process.env.NODE_ENV === "production",
  logLevel: process.env.LOG_LEVEL,
  sesAccessKeyId: process.env.SES_ACCESS_KEY_ID,
  sesSecretAccessKey: process.env.SES_SECRET_ACCESS_KEY,
  smtpUser: process.env.STMP_USER || 'no-reply@aker-bergeron.dev',
};
