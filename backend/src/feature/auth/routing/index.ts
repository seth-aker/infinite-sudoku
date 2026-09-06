import { AuthRouter } from "./authRouter";
import { AuthenticationServiceImpl } from "../service/authenticationServiceImpl";
import { PgUserDataSource } from "@/feature/users/datasource/pgUserDataSource";
import sql from "@/core/dataSource/postgres";
import { PgTokenDataSource } from "../datasource/pgAccessTokenDataSource";
import { PgResetTokenDataSource } from "../datasource/pgResetTokenDataSource";

const userDataSource = PgUserDataSource.create(sql)
const accessTokenDataSource = PgTokenDataSource.create(sql)
const resetTokenSource = PgResetTokenDataSource.create(sql);
const authService = AuthenticationServiceImpl.create(userDataSource, accessTokenDataSource, resetTokenSource)
export const authRouter = AuthRouter(authService)
