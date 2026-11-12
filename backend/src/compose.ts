import { PgUserDataSource } from "./feature/users/datasource/pgUserDataSource";
import { PgRefreshTokenDataSource } from "./feature/auth/datasource/pgRefreshTokenDataSource";
import { PgResetTokenDataSource } from "./feature/auth/datasource/pgResetTokenDataSource";
import { PgValidateTokenDataSource } from "./feature/auth/datasource/pgValidateTokenDataSource";
import { AppConfig } from "./core/config";
import { AuthenticationServiceImpl } from "./feature/auth/service/authenticationServiceImpl";
import { AppRouter } from "./app";
import { AuthRouter } from "./feature/auth/routing/authRouter";
import { PgSudokuDataSource } from "./feature/sudoku/datasource/pgSudokuDataSource";
import { SudokuServiceImplementation } from "./feature/sudoku/service/sudokuServiceImplementation";
import { SudokuRouter } from "./feature/sudoku/routing/sudokuRouter";
import { UserServiceImplementation } from "./feature/users/service/userServiceImplementation";
import { UserRouter } from "./feature/users/routing/userRouter";
import { HealthRouter } from "./feature/health/routing/healthRouter";
import { Sql } from "postgres";
import { createEmailer } from "./core/email/createEmailer";
import { WorkerPoolManager } from "./core/workers/workerpoolManager";
import prexit from "prexit";
export async function composeRouters(sql: Sql, config: AppConfig) {
  const routers = [] as AppRouter[]

  const userDataSource = PgUserDataSource.create(sql);
  const refreshTokenDataSource = PgRefreshTokenDataSource.create(sql);
  const resetTokenDataSource = PgResetTokenDataSource.create(sql);
  const validateTokenSource = PgValidateTokenDataSource.create(sql);
  const emailer = createEmailer(config);


  const authService = AuthenticationServiceImpl.create(
    userDataSource,
    refreshTokenDataSource,
    resetTokenDataSource,
    validateTokenSource,
    emailer
  );
  const authRouter = new AuthRouter(authService).setup();

  const sudokuDataSource = PgSudokuDataSource.create(sql);
  const workPoolManager = new WorkerPoolManager(config.workerPoolConfig)
  const sudokuService = SudokuServiceImplementation.create(sudokuDataSource, workPoolManager);
  const sudokuRouter = new SudokuRouter(sudokuService).setup();

  const userService = UserServiceImplementation.create(userDataSource);
  const userRouter = new UserRouter(userService).setup();

  const healthRouter = new HealthRouter(sql).setup();
  routers.push({ path: "/auth", router: authRouter });
  routers.push({ path: "/sudoku", router: sudokuRouter });
  routers.push({ path: "/users", router: userRouter });
  routers.push({ path: "/", router: healthRouter });

  prexit(() => {
    refreshTokenDataSource.close();
    resetTokenDataSource.close();
    validateTokenSource.close();
  })
  return routers;
}

