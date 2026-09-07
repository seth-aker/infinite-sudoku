import { AuthRouter } from "./authRouter";
import { AuthenticationServiceImpl } from "../service/authenticationServiceImpl";
import { PgUserDataSource } from "@/feature/users/datasource/pgUserDataSource";
import sql from "@/core/dataSource/postgres";
import { PgRefreshTokenDataSource } from "../datasource/pgRefreshTokenDataSource";
import { PgResetTokenDataSource } from "../datasource/pgResetTokenDataSource";

const userDataSource = PgUserDataSource.create(sql)
const refreshTokenDataSource = PgRefreshTokenDataSource.create(sql)
const resetTokenSource = PgResetTokenDataSource.create(sql);
const authService = AuthenticationServiceImpl.create(userDataSource, refreshTokenDataSource, resetTokenSource)
export const authRouter = AuthRouter(authService)
