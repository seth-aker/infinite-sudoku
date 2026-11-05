import { Router, Request } from "express";
import { MobileAuthRouter } from "./mobile/mobileAuthrouter.ts";
import {
  resetPasswordRateLimiter,
} from "../middleware/rateLimiter.ts";
import {
  resetRequestValidator,
} from "../middleware/validation.ts";
import { WebAuthRouter } from "./web/webAuthRouter.ts";
import { AuthenticationService } from "../service/authenticationService.ts";

export class AuthRouter {
  private authService: AuthenticationService;
  public constructor(authService: AuthenticationService,) {
    this.authService = authService;
  }
  public setup(): Router {
    const router = Router();
    const mobileAuthRouter = MobileAuthRouter(this.authService);
    const webAuthRouter = WebAuthRouter(this.authService);
    router.use("/mobile", mobileAuthRouter);
    router.use("/web", webAuthRouter);

    router.post(
      "/resetPasswordToken",
      resetPasswordRateLimiter,
      resetRequestValidator,
      async (req: Request<{}, {}, { email: string }>, res) => {
        await this.authService.requestPasswordResetToken(req.body.email);
        return res.sendStatus(204);
      },
    );
    router.post(
      '/validateEmail',
      async (req: Request<{}, {}, {}, { token: string }>, res) => {
        const token = req.query.token;
        const validated = await this.authService.validateEmail(token)
        if (!validated) {
          return res.sendStatus(500)
        }
        return res.sendStatus(204);
      })

    router.post(
      '/requestEmailVerification',
      resetPasswordRateLimiter,
      resetRequestValidator,
      async (req: Request<{}, {}, { email: string }>, res) => {
        await this.authService.requestEmailVerification(req.body.email);
        return res.sendStatus(204)
      }
    )
    return router;

  }
}
