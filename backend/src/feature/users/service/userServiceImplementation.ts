import { UserService } from "./userService";
import { UserDataSource } from "../datasource/userDataSource";
import { ISqlUser, IUserDTO } from "../datasource/models/user";

export class UserServiceImplementation implements UserService {
  private userDataSource: UserDataSource;
  private constructor(userDataSource: UserDataSource) {
    this.userDataSource = userDataSource;
  }
  static instance: UserService | null = null;
  static create(userDataSource: UserDataSource) {
    if (UserServiceImplementation.instance === null) {
      UserServiceImplementation.instance = new UserServiceImplementation(
        userDataSource,
      );
    }
    return UserServiceImplementation.instance;
  }
  async getUser(userId: string) {
    // userDataSource throws if user isn't defined so user will always be defined here
    const user = await this.userDataSource.getUser(userId);
    return this.serializeUser(user);
  }
  async getUserStats(userId: string) {
    return await this.userDataSource.getUserStats(userId);
  }
  async deleteUser(userId: string) {
    return await this.userDataSource.deleteUser(userId);
  }

  private serializeUser(sqlUser: ISqlUser) {
    const userDTO: IUserDTO = {
      id: sqlUser.user_id,
      email: sqlUser.email,
      emailVerified: sqlUser.email_verified,
      username: sqlUser.username,
      role: sqlUser.role,
      imageUrl: sqlUser.image_url ?? undefined,
      currentPuzzleId: sqlUser.current_puzzle_id ?? undefined,
    };
    return userDTO;
  }
}
