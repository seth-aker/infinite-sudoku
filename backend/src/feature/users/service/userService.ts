import { IUserDTO } from "../datasource/models/user";
import { IUserStats } from "../datasource/models/userStats";

export interface UserService {
  // createUser: (user: ICreateUser) => Promise<ISqliteUser>;
  getUser: (userId: string) => Promise<IUserDTO>;
  getUserStats: (userId: string) => Promise<IUserStats>;
  // updateUser: (userId: string, user: IUserDTO) => Promise<number>;
  deleteUser: (userId: string) => Promise<number>;
}
