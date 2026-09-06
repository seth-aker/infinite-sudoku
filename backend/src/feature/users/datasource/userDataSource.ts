import { ICreateUser, ISqlUser } from "./models/user";
import { IUserStats } from "./models/userStats";

export interface UserDataSource {
  createUser: (user: ICreateUser) => Promise<string | undefined>;
  getUserByEmail: (email: string) => Promise<ISqlUser>;
  getUser: (userId: string) => Promise<ISqlUser>;
  getUserStats: (userId: string) => Promise<IUserStats>
  changePassword: (userId: string, newPassword: string, newSalt: string) => Promise<void>
  // updateUser: (userId: string, user: UpdateUser) => Promise<number>;
  deleteUser: (userId: string) => Promise<number>;
}
