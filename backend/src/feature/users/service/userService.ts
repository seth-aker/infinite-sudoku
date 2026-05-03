import { IUserDTO } from "../datasource/models/user";

export interface UserService {
  // createUser: (user: ICreateUser) => Promise<ISqliteUser>;
  getUser: (userId: string) => Promise<IUserDTO>;
  // updateUser: (userId: string, user: IUserDTO) => Promise<number>;
  deleteUser: (userId: string) => Promise<number>;
}
