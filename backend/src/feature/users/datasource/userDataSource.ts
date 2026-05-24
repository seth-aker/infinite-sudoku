import { ICreateUser, ISqlUser } from "./models/user";
import { IUserStats } from "./models/userStats";

export interface UserDataSource {
  createUser: (user: ICreateUser) => Promise<string | undefined>;
  getUser: (userId: string) => Promise<ISqlUser>;
  getUserStats: (userId: string) => Promise<IUserStats>
  // updateUser: (userId: string, user: UpdateUser) => Promise<number>;
  deleteUser: (userId: string) => Promise<number>;
}
