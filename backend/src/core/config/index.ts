import dotenv from 'dotenv'
import process from "node:process";
dotenv.config();

if (!process.env.DB_CONNECTION_STRING) {
  throw new Error('Invalid/Missing environment variable: "DB_CONNECTION_STRING"')
}
if(!process.env.JWT_SECRET) {
  throw new Error('Invalid/Missing environment varibale: JWT_SECRET')
}

export const config = {
  port: process.env.PORT || 3666,
  dbConnectionString: process.env.DB_CONNECTION_STRING,
  dbName: process.env.DB_NAME || 'dev',
  origin: process.env.ORIGIN || 'http://127.0.0.1:5173',
  issuer: process.env.ISSUER || 'http://localhost:3666',
  audience: process.env.AUDIENCE || 'http://localhost:3666',
  rootDir: process.env.ROOT_DIR || process.cwd(),
  puzzleGeneratorWorkerPath: process.env.WORKER_PATH || '/home/saker/workspace/vue-sudoku/backend/src/feature/sudoku/puzzleSolver/puzzleGeneratorInC.ts',
  jwtSecret: process.env.JWT_SECRET,
  isProduction: process.env.NODE_ENV === 'production',
  logLevel: process.env.LOG_LEVEL,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT,
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
}
