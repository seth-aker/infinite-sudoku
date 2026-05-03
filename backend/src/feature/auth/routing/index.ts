import { AuthRouter } from "./authRouter";
import { AuthenticationServiceImpl } from "../service/authenticationServiceImpl";
import { PgUserDataSource } from "@/feature/users/datasource/pgUserDataSource";
import sql from "@/core/dataSource/postgres";

const userDataSource = PgUserDataSource.create(sql)
const authService = AuthenticationServiceImpl.create(sql, userDataSource)
export const authRouter = AuthRouter(authService)
