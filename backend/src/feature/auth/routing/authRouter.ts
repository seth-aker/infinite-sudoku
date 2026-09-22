import { Router, Request } from "express";
import { MobileAuthRouter } from "./mobile/mobileAuthrouter.ts";
import { PgUserDataSource } from "@/feature/users/datasource/pgUserDataSource.ts";
import sql from "@/core/dataSource/postgres.ts";
import { PgRefreshTokenDataSource } from "../datasource/pgRefreshTokenDataSource.ts";
import { PgResetTokenDataSource } from "../datasource/pgResetTokenDataSource.ts";
import {
  resetPasswordRateLimiter,
} from "../middleware/rateLimiter.ts";
import {
  resetRequestValidator,
} from "../middleware/validation.ts";
import { AuthenticationServiceImpl } from "../service/authenticationServiceImpl.ts";
import { WebAuthRouter } from "./web/webAuthRouter.ts";
import { PgValidateTokenDataSource } from "../datasource/pgValidateTokenDataSource.ts";

function AuthRouter() {
  const router = Router();
  const userDataSource = PgUserDataSource.create(sql);
  const refreshTokenDataSource = PgRefreshTokenDataSource.create(sql);
  const resetTokenSource = PgResetTokenDataSource.create(sql);
  const validateTokenSource = PgValidateTokenDataSource.create(sql);
  const authService = AuthenticationServiceImpl.create(
    userDataSource,
    refreshTokenDataSource,
    resetTokenSource,
    validateTokenSource,
  );
  const mobileAuthRouter = MobileAuthRouter(authService);
  const webAuthRouter = WebAuthRouter(authService);

  router.use("/mobile", mobileAuthRouter);

  router.use("/web", webAuthRouter);

  router.post(
    "/resetPasswordToken",
    resetPasswordRateLimiter(),
    resetRequestValidator,
    async (req: Request<{}, {}, { email: string }>, res) => {
      await authService.requestPasswordResetToken(req.body.email);
      return res.sendStatus(204);
    },
  );
  router.use(
    '/validateEmail',
    async (req: Request<{}, {}, {}, { token: string }>, res) => {
      const token = req.query.token;
      const validated = await authService.validateEmail(token)
      if (!validated) {
        return res.sendStatus(500)
      }
      return res.sendStatus(204);
    })
  return router;
}

export const authRouter = AuthRouter();
