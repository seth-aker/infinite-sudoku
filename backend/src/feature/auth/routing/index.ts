import { AuthRouter } from "./authRouter";
import { AuthenticationServiceImpl } from "../service/authenticationServiceImpl";
import { PgUserDataSource } from "@/feature/users/datasource/pgUserDataSource";
import sql from "@/core/dataSource/postgres";
import { UserServiceImplementation } from "@/feature/users/service/userServiceImplementation";

const userDataSource = PgUserDataSource.create(sql)
const userService = UserServiceImplementation.create(userDataSource);
const authService = AuthenticationServiceImpl.create(sql, userDataSource)
export const authRouter = AuthRouter(authService, userService)
