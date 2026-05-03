import { ICreateUser, ISqlUser } from "./models/user";

export interface UserDataSource {
  createUser: (user: ICreateUser) => Promise<string | undefined>;
  getUser: (userId: string) => Promise<ISqlUser>;
  // updateUser: (userId: string, user: UpdateUser) => Promise<number>;
  deleteUser: (userId: string) => Promise<number>;
}
