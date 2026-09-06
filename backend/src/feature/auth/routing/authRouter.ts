import { Request, Response, Router } from "express";
import { loginBodyValidator, passwordResetSchema, registerBodyValidator, tokenBodyValidator, } from "../middleware/validation";
import { AuthenticationError } from "../errors/authenticationError";
import { AuthenticationService } from "../service/authenticationService";
import { authLimiter } from "../middleware/rateLimiter";
import { clearAuthCookies, setAuthCookies } from "../utils/cookies";
import { ErrorType } from "@/core/errors/errorTypes";
import { DatabaseError } from "@/core/errors/databaseError";
import { requireLoggedin } from "../middleware/authentication";

type TokenPasswordBody = {
  grantType: 'password',
  email: string,
  password: string,
}

type TokenRefreshBody = {
  grantType: 'refreshToken',
  refreshToken: string
}

type TokenRequestBody = TokenPasswordBody | TokenRefreshBody;

export function AuthRouter(authService: AuthenticationService) {
  const router = Router()

  // web only endpoint
  router.post('/login', authLimiter(),  loginBodyValidator, async (req, res, _next) => {
    const user = await authService.verify(req.body.email, req.body.password)

    const {accessToken, refreshToken} = await authService.getNewTokenSet(user.id);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({ user })
  })

  router.post('/logout', authLimiter(), requireLoggedin, async (req, res) => {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

    if(refreshToken) {
      await authService.clearRefreshToken(refreshToken);
    }

    clearAuthCookies(res);

    res.sendStatus(204);
  })

  router.post('/register', authLimiter(), registerBodyValidator, async (req, res, _next) => {
    const userId = await authService.registerUser(req.body)
    if(!userId) {
      throw new DatabaseError("An error occured registering the user")
    }
    // TODO: Send email verification
    return res.status(201).json({
      id: userId,
      email: req.body.email,
      username: req.body.username,
      role: 'user'
    })
  })

  // web only endpoint
  router.post('/refresh', authLimiter(), async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if(!refreshToken) {
      return res.status(401).send({error: 'Refresh token required'})
    }
    const {accessToken, refreshToken: newRefreshToken} = await authService.refreshAccessToken(refreshToken);

    setAuthCookies(res, accessToken, newRefreshToken);
    res.sendStatus(201)
  })

  // mobile only endpoint
  router.post('/token', authLimiter(), tokenBodyValidator, async (req: Request<{}, {}, TokenRequestBody>, res: Response, _next) => {
    switch(req.body.grantType) {
      case 'password': {
        const user = await authService.verify(req.body.email, req.body.password)
     
       const { accessToken, refreshToken } = await authService.getNewTokenSet(user.id);

        res.json({accessToken, refreshToken, user})
        return;
      }
      case 'refreshToken':{
        const refreshToken = req.body.refreshToken;
        if(!refreshToken) {
          throw new AuthenticationError('Missing or invalid refresh token.', {
            type: ErrorType.TOKEN_MISSING
          })
        }
        const {accessToken, refreshToken: newRefreshToken} = await authService.refreshAccessToken(refreshToken);
        return res.json({accessToken, refreshToken: newRefreshToken})
      }
      default: {
        throw new AuthenticationError('Invalid grantType', {
          type: ErrorType.MALFORMED_BODY 
        })
      }
    }
  })

  router.post('/resetPasswordToken', authLimiter(), async (req, res) => {
    const user = req.user;
    if(!user) {
      throw new AuthenticationError("Invalid access token", {type: "validation_failed"})
    }
    await authService.requestPasswordResetToken(user.userId);
    return res.sendStatus(204);
  })

  router.put('/passwordReset', authLimiter(), passwordResetSchema, async (req: Request<{},{},{password: string}, {resetToken: string}>, res) => {
    const resetToken = req.query.resetToken;
    const newPassword = req.body.password;
    const tokens = await authService.resetPassword(resetToken, newPassword);
    return res.json(tokens);
  })
  return router
}
