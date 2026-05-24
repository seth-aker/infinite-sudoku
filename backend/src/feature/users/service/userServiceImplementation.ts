import { BaseService } from "@/core/service/baseService";
import { UserService } from "./userService";
import { UserDataSource } from "../datasource/userDataSource";
import { ISqlUser, IUserDTO } from "../datasource/models/user";
import { NotFoundError } from "@/core/errors/notFoundError";

export class UserServiceImplementation extends BaseService implements UserService {
  private userDataSource: UserDataSource;
  private constructor(userDataSource: UserDataSource) {
    super();
    this.userDataSource = userDataSource;
  }
  static instance: UserService | null = null;
  static create(userDataSource: UserDataSource) {
    if(UserServiceImplementation.instance === null) {
      UserServiceImplementation.instance = new UserServiceImplementation(userDataSource);
    }
    return UserServiceImplementation.instance;
  }
  async getUser(userId: string) {
    return await this.callDataSource(async () => {
      // userDataSource throws if user isn't defined so user will always be defined here
      const user = await this.userDataSource.getUser(userId);
      return this.serializeUser(user)
    })
  }
  async getUserStats(userId: string) {
    return await this.callDataSource(async () => {
      const userStats = await this.userDataSource.getUserStats(userId);
      if(userStats.length < 1) {
        throw new NotFoundError('No user stats found')
      }
      return userStats
    })
  }
  async deleteUser(userId: string) {
    return await this.callDataSource(async () => {
      return await this.userDataSource.deleteUser(userId);
    })
  }

  private serializeUser(sqlUser: ISqlUser) {
    const userDTO: IUserDTO = {
      id: sqlUser.user_id,
      displayName: sqlUser.display_name,
      username: sqlUser.username, 
      role: sqlUser.role, 
      imageUrl: sqlUser.image_url,
      currentPuzzleId: sqlUser.current_puzzle_id
    }
    return userDTO;
  }
}
