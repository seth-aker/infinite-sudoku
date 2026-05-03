import { ISqlUser } from "@/feature/users/datasource/models/user";
import { scryptSync, timingSafeEqual, randomBytes } from "node:crypto";
import { AuthenticationService, IVerifyResponse } from "./authenticationService";
import { AuthenticationError } from "../errors/authenticationError";
import { UserDataSource } from "@/feature/users/datasource/userDataSource";
import { registerBodySchema } from "../middleware/validation";
import z from "zod";
import { DatabaseError } from "@/core/errors/databaseError";
import { CustomError } from "@/core/errors/customError";
import { Sql } from "postgres";
import { SqlUserPuzzle } from "@/feature/sudoku/datasource/models/sudokuPuzzle";

declare global {
    namespace Express {
        interface User {
            id: string,
            username: string,
            role: string
        }
    }
}

export class AuthenticationServiceImpl implements AuthenticationService {
  static instance: AuthenticationServiceImpl | null = null;
  private client: Sql
  private userDataSource: UserDataSource;
  private constructor(db: Sql, userDataSource: UserDataSource) {
    this.client = db;
    this.userDataSource = userDataSource;
  }
  static create(db: Sql, userDataSource: UserDataSource): AuthenticationServiceImpl {
    if(AuthenticationServiceImpl.instance === null) {
      AuthenticationServiceImpl.instance = new AuthenticationServiceImpl(db, userDataSource);
    }
    return AuthenticationServiceImpl.instance
  }
  async verify(username: string, password: string): Promise<IVerifyResponse> {
    try {
      const [res] = await this.client<ISqlUser[]>`SELECT * FROM users WHERE username = ${username}`
      if(!res || !res.password_hash || !res.salt) {
        return {err: new AuthenticationError("Incorrect Username or Password")}
      }
      const hashedPassword = scryptSync(password.normalize(), Buffer.from(res.salt, 'hex'), 64)
      if(!timingSafeEqual(Buffer.from(res.password_hash, 'hex'), hashedPassword)) {
        return {err: new AuthenticationError("Incorrect Username or Password")}
      }
      
      return {
        user: {
          id: res.user_id,
          username: res.username,
          role: res.role,
          displayName: res.display_name ?? undefined,
          imageUrl: res.image_url ?? undefined,
          currentPuzzleId: res.current_puzzle_id ?? undefined
        }
      }
    } catch (err) {
      return {err}
    }
  }
  async registerUser(user: z.infer<typeof registerBodySchema>) {
    try {
      const salt = randomBytes(16);
      const hashedPassword = scryptSync(user.password.normalize(), salt, 64);

      const userId = await this.userDataSource.createUser({
        displayName: user.displayName,
        username: user.username,
        passwordHash: hashedPassword.toString('hex'),
        salt: salt.toString('hex')
      })

      if(!userId) {
        throw new DatabaseError(`Insert Operation failed`)
      }
      return userId

    } catch (err) {
      if(err instanceof CustomError) {
        throw err
      }
      throw new AuthenticationError(`An error occurred registering user: ${err}`)
    }

  }
  serializeUser(user: Express.User, callback: (err?: any, user?: Express.User) => void) {
    process.nextTick(() => {
      callback(null, {id: user.id, username: user.username, role: user.role})
    })
  }
  deserializeUser(user: Express.User, callback: (err?: any, user?: Express.User) => void) {
    process.nextTick(() => {
      callback(null, {id: user.id, username: user.username, role: user.role})
    })
  }
}
