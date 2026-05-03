import { SessionData, Store } from "express-session";
import { EventEmitterOptions } from "node:events";
import { Sql } from "postgres";

const noop = (..._args: any) => {};

export interface PgSessionStoreOptions extends EventEmitterOptions {
  client: Sql
}
export class PgSessionStore extends Store {
  static instance: PgSessionStore | null = null;
  private client: Sql
  private ONE_DAY_MS = 1000 * 60 * 60 * 24;
  private CLEAR_INTERVAL = 1000 * 60 * 15;
  private timer: NodeJS.Timeout;
  private constructor(options: PgSessionStoreOptions) {
    super(options)

    this.client = options.client;
    this.timer = setInterval(async () => {
      try {
        await this.client`
          DELETE FROM sessions WHERE expire < to_timestamp(${this.currentPgTimestamp()})
        `
        } catch (err) {
          console.error(err)
        }
    }, this.CLEAR_INTERVAL)
    this.timer.unref()
  }
  public close() {
    clearInterval(this.timer)
  }
  static create(options: PgSessionStoreOptions) {
    if(!PgSessionStore.instance) {
      PgSessionStore.instance = new PgSessionStore(options)
    }
    return PgSessionStore.instance
  }
  get(sid: string, callback: (err: any, session?: SessionData | null) => void): void {
    this.client`
      SELECT sess FROM sessions WHERE sid = ${sid} AND expire >= to_timestamp(${this.currentPgTimestamp()})
    `.then((res) => {
      if(res.length === 0) {
        return callback(null)
      }
      try {
        return callback(null, (typeof res[0].sess === 'string') ? JSON.parse(res[0].sess) : res[0].sess)
      } catch {
        return this.destroy(sid, callback);
      }
    }).catch((err) => {
      return callback(err)
    })
  }
  set(sid: string, session: SessionData, callback: (err?: any) => void = noop): void {
    try {
      const expireTime = session.cookie.expires ? Math.ceil(session.cookie.expires.valueOf() / 1000) : Math.ceil((Date.now() + this.ONE_DAY_MS) / 1000)
      const sess = JSON.stringify(session)
      this.client`
        INSERT INTO sessions (sid, sess, expire) 
        SELECT ${sid}, ${sess}, to_timestamp(${expireTime})
        ON CONFLICT (sid) DO UPDATE 
        SET sess = ${sess}, expire = to_timestamp(${expireTime})
        RETURNING sid; `
        .then(() => callback(null))
        .catch((err) => {
          return callback(err)
        })
    } catch (err) {
      return callback(err)
    }
  }

  destroy(sid: string, callback: (err?: any) => void = noop): void {
    try {
      this.client`
      DELETE FROM sessions WHERE sid = ${sid}
      `.then(() => callback(null))
      .catch((err) => {
        return callback(err)
      })
    } catch (err) {
      return callback(err)
    }
  }

  touch(sid: string, session: SessionData, callback: (err?: any) => void = noop): void {
    const expireTime = session.cookie.expires ? Math.ceil(session.cookie.expires.valueOf() / 1000) : Math.ceil((Date.now() + this.ONE_DAY_MS) / 1000)
    try {
      this.client`
        UPDATE sessions SET expire = to_timestamp(${expireTime}) WHERE sid = ${sid} RETURNING sid;
      `.then(() => callback(null))
      .catch((err) => callback(err))
    } catch (err) {
      return callback(err)
    }
  }

  currentPgTimestamp() {
    return Math.ceil(Date.now() / 1000)
  }
}
