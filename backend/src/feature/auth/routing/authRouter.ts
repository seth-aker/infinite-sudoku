import { Router, Request} from "express";
import { MobileAuthRouter } from "./mobile/mobileAuthrouter.ts";
import { PgUserDataSource } from "@/feature/users/datasource/pgUserDataSource.ts";
import sql from "@/core/dataSource/postgres.ts";
import { PgRefreshTokenDataSource } from "../datasource/pgRefreshTokenDataSource.ts";
import { PgResetTokenDataSource } from "../datasource/pgResetTokenDataSource.ts";
import { resetPasswordRateLimiter, authLimiter } from "../middleware/rateLimiter.ts";
import { resetRequestValidator, passwordResetValidator } from "../middleware/validation.ts";
import { AuthenticationServiceImpl } from "../service/authenticationServiceImpl.ts";
import { WebAuthRouter } from "./web/webAuthRouter.ts";

function AuthRouter() {
  const router = Router();
  const userDataSource = PgUserDataSource.create(sql)
  const refreshTokenDataSource = PgRefreshTokenDataSource.create(sql)
  const resetTokenSource = PgResetTokenDataSource.create(sql);
  const authService = AuthenticationServiceImpl.create(userDataSource, refreshTokenDataSource, resetTokenSource)
  const mobileAuthRouter = MobileAuthRouter(authService);
  const webAuthRouter = WebAuthRouter(authService);

  router.use('/mobile', mobileAuthRouter);

  router.use('/web', webAuthRouter)

  router.post('/resetPasswordToken', resetPasswordRateLimiter(), resetRequestValidator,  async (req: Request<{}, {}, {email: string}>, res) => {
    await authService.requestPasswordResetToken(req.body.email);
    return res.sendStatus(204);
  })

  router.put('/passwordReset', authLimiter(), passwordResetValidator, async (req: Request<{},{},{password: string}, {resetToken: string}>, res) => {
    const resetToken = req.query.resetToken;
    const newPassword = req.body.password;
    const tokens = await authService.resetPassword(resetToken, newPassword);
    return res.json(tokens);
  })
  return router;
}

export const authRouter = AuthRouter();
