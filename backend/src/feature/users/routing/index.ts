import { UserServiceImplementation } from "../service/userServiceImplementation";
import { UserRouter } from "./userRouter";
import { PgUserDataSource } from "../datasource/pgUserDataSource";
import sql from "@/core/dataSource/postgres";

const userDataSource =  PgUserDataSource.create(sql)
const userService = UserServiceImplementation.create(userDataSource)
export const userRouter = UserRouter(userService)
