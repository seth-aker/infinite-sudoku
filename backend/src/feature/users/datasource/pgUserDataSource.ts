import { Sql } from "postgres";
import { UserDataSource } from "./userDataSource";
import { ICreateUser, ISqlUser } from "./models/user";
import { DatabaseError } from "@/core/errors/databaseError";
import { IDifficultyStats, IUserStats } from "./models/userStats";

export class PgUserDataSource implements UserDataSource {
  static instance: PgUserDataSource | null = null;
  private client: Sql;
  private constructor(client: Sql) {
    this.client = client;
  }
  static create(client: Sql) {
    if(!PgUserDataSource.instance) {
      PgUserDataSource.instance = new PgUserDataSource(client);
    }
    return PgUserDataSource.instance;
  }

  async createUser(user: ICreateUser): Promise<string | undefined> {
    const [res] = await this.client<{user_id: string}[]>`
      INSERT INTO users (
        display_name,
        username,
        password_hash,
        salt
      )
      VALUES (
        ${user.displayName ?? null},
        ${user.username},
        ${user.passwordHash},
        ${user.salt}
      ) 
      RETURNING user_id;
    `
    return res.user_id;
  }
  async getUser(userId: string): Promise<ISqlUser> {
    const [user] = await this.client<ISqlUser[]>`
     SELECT u.user_id,
        u.display_name,
        u.username,
        u.role,
        u.current_puzzle_id,
        u.image_url,
        u.created_at,
        u.updated_at
      FROM 
        users as u
      WHERE 
        u.user_id = ${userId} 
        AND u.deleted_at IS NULL
    `
    if(!user) {
      throw new DatabaseError("User not found")
    }
    return user;
  }
  async getUserStats(userId: string): Promise<IUserStats> {
    const res = await this.client`
      SELECT 
        p.difficulty_rating AS rating,
        AVG(p.difficulty_score) AS avg_score,
        COUNT(up.puzzle_id) as total_started,
        COUNT(up.completed_at) AS completed,
        AVG(up.time) AS avg_time_sec,
        SUM(up.time) AS total_time_sec
      FROM user_puzzles AS up
      LEFT JOIN puzzles AS p ON p.puzzle_id = up.puzzle_id
      WHERE up.user_id = ${userId}
      GROUP BY p.difficulty_rating
    `
    const userStats: IDifficultyStats[] = res.map(eachRow => ({
      rating: eachRow.rating,
      avgScore: eachRow.avg_score,
      totalStarted: eachRow.total_started,
      completed: eachRow.completed,
      avgTimeSec: eachRow.avg_time_sec,
      totalTimeSec: eachRow.total_time_sec
    }))
    return userStats
  }
  async deleteUser(userId: string): Promise<number> {
    const res = await this.client`
      UPDATE users
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId}
    `
    if(res.length) {
      return res.length
    } else {
      throw new DatabaseError('Failed to delete user')
    }
  }
}
