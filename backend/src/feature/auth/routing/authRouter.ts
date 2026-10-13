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
import { config } from "@/core/config/index.ts";
import { createTransport, Transporter } from "nodemailer";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { Emailer } from "../email/smtpEmailer.ts";
function AuthRouter() {
  const router = Router();
  const userDataSource = PgUserDataSource.create(sql);
  const refreshTokenDataSource = PgRefreshTokenDataSource.create(sql);
  const resetTokenSource = PgResetTokenDataSource.create(sql);
  const validateTokenSource = PgValidateTokenDataSource.create(sql);
  let transporter: Transporter;
  if (config.isProduction) {
    transporter = createTransport({
      SES: {
        sesClient: new SESv2Client({
          region: "us-east-1",
          credentials: {
            accessKeyId: config.sesAccessKeyId,
            secretAccessKey: config.sesSecretAccessKey,
          }
        }), SendEmailCommand
      }
    })
  } else {
    transporter = createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: 'emerald9@ethereal.email',
        pass: 'pfRS4GPAWQdGyyFcEh'
      }
    })
  }
  const emailer = new Emailer(transporter);
  const authService = AuthenticationServiceImpl.create(
    userDataSource,
    refreshTokenDataSource,
    resetTokenSource,
    validateTokenSource,
    emailer,
  );
  const mobileAuthRouter = MobileAuthRouter(authService);
  const webAuthRouter = WebAuthRouter(authService);

  router.use("/mobile", mobileAuthRouter);

  router.use("/web", webAuthRouter);

  router.post(
    "/resetPasswordToken",
    resetPasswordRateLimiter,
    resetRequestValidator,
    async (req: Request<{}, {}, { email: string }>, res) => {
      await authService.requestPasswordResetToken(req.body.email);
      return res.sendStatus(204);
    },
  );
  router.post(
    '/validateEmail',
    async (req: Request<{}, {}, {}, { token: string }>, res) => {
      const token = req.query.token;
      const validated = await authService.validateEmail(token)
      if (!validated) {
        return res.sendStatus(500)
      }
      return res.sendStatus(204);
    })

  router.post(
    '/requestEmailVerification',
    resetPasswordRateLimiter,
    resetRequestValidator,
    async (req: Request<{},{}, {email: string}>, res) => {
      await authService.requestEmailVerification(req.body.email);
      return res.sendStatus(204)
    }
  )
  return router;
}

export const authRouter = AuthRouter();
