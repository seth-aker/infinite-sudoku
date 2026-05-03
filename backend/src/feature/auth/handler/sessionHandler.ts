import session from 'express-session'
import { authConfig } from '../config'
import { config } from '@/core/config'
import { Request } from 'express'
import { PgSessionStore } from '../datasource/pgSessionStore'
import sql from '@/core/dataSource/postgres'

export const sessionHandler = () => {
  return session({
    secret: authConfig.secret,
    store: PgSessionStore.create({client: sql}),
    resave: false,
    saveUninitialized: false,
    cookie: function (req: Request) {
      return {
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        // domain: config.audience,
        secure: req.secure || process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? true : false
      }
      
    },
    name: 'sudoku',
  })
}
