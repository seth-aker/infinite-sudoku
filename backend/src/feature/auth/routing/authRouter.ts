// import { UserDataSource } from "@/feature/users/datasource/userDataSource";
import { Router } from "express";
import { loginBodyValidator, registerBodyValidator } from "../middleware/validation";
import { AuthenticationError } from "../errors/authenticationError";
import { AuthenticationService } from "../service/authenticationService";

declare module 'express-session' {
    interface SessionData {
      user?: {
        id: string;
        username: string;
        role: string;
      }
    }
}

export function AuthRouter(authService: AuthenticationService) {
  const router = Router()

  router.post('/login', loginBodyValidator, async (req, res, next) => {
    const verifyRes = await authService.verify(req.body.username, req.body.password)
    const user = verifyRes.user;
    if(!user || verifyRes.err) {
      return next(verifyRes?.err ?? new AuthenticationError("Incorrect email or password"))
    }
    req.session.regenerate((err) => {
      if(err) {
        return next(err)
      }
      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role
      }

      req.session.save((err) => {
        if(err) {
          return next(err)
        }
        return res.json(user)
      })
    })
  })

  router.get('/logout', async (req, res, next) => {
    req.session.user = undefined

    req.session.save((err) => {
      if(err) {
        next(err)
      }
      req.session.regenerate((err) => {
        if(err) {
          next(err)
        }
        res.sendStatus(204)
      })
    })
  })

  router.post('/register', registerBodyValidator, async (req, res, next) => {
    const userId = await authService.registerUser(req.body)
    if(!userId) {
      return res.sendStatus(500)
    }
    req.session.regenerate((err) => {
      if(err) {
        next(err);
      }
      req.session.user = {
        username: req.body.username,
        id: userId,
        role: 'user'
      }

      req.session.save((err) => {
        if(err) {
          next(err)
        }
        res.status(201).send({
          id: userId,
          displayName: req.body.displayName,
          username: req.body.username,
          role: 'user'
        })
      })
    })
  })
  return router
}
