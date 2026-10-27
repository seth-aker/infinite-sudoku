import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "express";
import { NotFoundError } from "@/core/errors/notFoundError";
import { BadRequestError } from "@/core/errors/badRequestError";
import { buildApp, startServer, type TestServer } from "#test/helpers/http";
import type { MockAuthService } from "#test/helpers/mocks";

const h = vi.hoisted(() => {
  const passthrough = (_req: unknown, _res: unknown, next: () => void) =>
    next();
  return {
    sql: { fake: "sql" },
    userDs: { name: "userDs" },
    refreshDs: { name: "refreshDs" },
    resetDs: { name: "resetDs" },
    validateDs: { name: "validateDs" },
    transport: { name: "transport" },
    service: {} as MockAuthService,
    createService: vi.fn(),
    createTransport: vi.fn(),
    SESv2Client: vi.fn(),
    SendEmailCommand: class SendEmailCommand {},
    Emailer: vi.fn(),
    mobileRouter: vi.fn(),
    webRouter: vi.fn(),
    resetLimiter: vi.fn(passthrough),
  };
});

vi.mock("@/core/dataSource/postgres", () => ({ default: h.sql }));
vi.mock("@/feature/users/datasource/pgUserDataSource", () => ({
  PgUserDataSource: { create: vi.fn(() => h.userDs) },
}));
vi.mock("@/feature/auth/datasource/pgRefreshTokenDataSource", () => ({
  PgRefreshTokenDataSource: { create: vi.fn(() => h.refreshDs) },
}));
vi.mock("@/feature/auth/datasource/pgResetTokenDataSource", () => ({
  PgResetTokenDataSource: { create: vi.fn(() => h.resetDs) },
}));
vi.mock("@/feature/auth/datasource/pgValidateTokenDataSource", () => ({
  PgValidateTokenDataSource: { create: vi.fn(() => h.validateDs) },
}));
vi.mock("@/feature/auth/service/authenticationServiceImpl", () => ({
  AuthenticationServiceImpl: { create: h.createService },
}));
vi.mock("nodemailer", () => ({ createTransport: h.createTransport }));
vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: h.SESv2Client,
  SendEmailCommand: h.SendEmailCommand,
}));
vi.mock("@/feature/auth/email/smtpEmailer", () => ({ Emailer: h.Emailer }));
vi.mock("@/feature/auth/routing/mobile/mobileAuthrouter", () => ({
  MobileAuthRouter: h.mobileRouter,
}));
vi.mock("@/feature/auth/routing/web/webAuthRouter", () => ({
  WebAuthRouter: h.webRouter,
}));
vi.mock("@/feature/auth/middleware/rateLimiter", () => ({
  resetPasswordRateLimiter: h.resetLimiter,
}));

function stubRouter(name: string) {
  const router = Router();
  router.get("/whoami", (_req, res) => {
    res.json({ name });
  });
  return router;
}

async function loadAuthRouter() {
  return (await import("@/feature/auth/routing/authRouter")).authRouter;
}

describe("authRouter", () => {
  beforeEach(() => {
    vi.resetModules();
    h.service = {
      requestPasswordResetToken: vi.fn(),
      validateEmail: vi.fn(),
      requestEmailVerification: vi.fn(),
    } as unknown as MockAuthService;
    h.createService.mockReturnValue(h.service);
    h.createTransport.mockReturnValue(h.transport);
    h.SESv2Client.mockImplementation(function (this: object, opts: unknown) {
      Object.assign(this, { opts });
    });
    h.Emailer.mockImplementation(function (this: object, t: unknown) {
      Object.assign(this, { transporter: t });
    });
    h.mobileRouter.mockImplementation(() => stubRouter("mobile"));
    h.webRouter.mockImplementation(() => stubRouter("web"));
  });

  describe("wiring", () => {
    it("creates data sources from the shared sql client", async () => {
      await loadAuthRouter();
      const { PgUserDataSource } =
        await import("@/feature/users/datasource/pgUserDataSource");
      const { PgRefreshTokenDataSource } =
        await import("@/feature/auth/datasource/pgRefreshTokenDataSource");
      const { PgResetTokenDataSource } =
        await import("@/feature/auth/datasource/pgResetTokenDataSource");
      const { PgValidateTokenDataSource } =
        await import("@/feature/auth/datasource/pgValidateTokenDataSource");
      expect(PgUserDataSource.create).toHaveBeenCalledWith(h.sql);
      expect(PgRefreshTokenDataSource.create).toHaveBeenCalledWith(h.sql);
      expect(PgResetTokenDataSource.create).toHaveBeenCalledWith(h.sql);
      expect(PgValidateTokenDataSource.create).toHaveBeenCalledWith(h.sql);
    });

    it("builds the auth service and passes it to the sub routers", async () => {
      await loadAuthRouter();
      expect(h.Emailer).toHaveBeenCalledWith(h.transport);
      expect(h.createService).toHaveBeenCalledWith(
        h.userDs,
        h.refreshDs,
        h.resetDs,
        h.validateDs,
        expect.objectContaining({ transporter: h.transport }),
      );
      expect(h.mobileRouter).toHaveBeenCalledWith(h.service);
      expect(h.webRouter).toHaveBeenCalledWith(h.service);
    });

    it("uses the ethereal smtp transport outside production", async () => {
      vi.stubEnv("NODE_ENV", "development");
      await loadAuthRouter();
      expect(h.createTransport).toHaveBeenCalledWith({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: expect.any(String), pass: expect.any(String) },
      });
      expect(h.SESv2Client).not.toHaveBeenCalled();
    });

    it("uses the SES transport in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      await loadAuthRouter();
      expect(h.SESv2Client).toHaveBeenCalledWith({
        region: "us-east-1",
        credentials: {
          accessKeyId: process.env.SES_ACCESS_KEY_ID,
          secretAccessKey: process.env.SES_SECRET_ACCESS_KEY,
        },
      });
      expect(h.createTransport).toHaveBeenCalledWith({
        SES: {
          sesClient: expect.objectContaining({ opts: expect.any(Object) }),
          SendEmailCommand: h.SendEmailCommand,
        },
      });
    });
  });

  describe("routes", () => {
    let server: TestServer;

    beforeEach(async () => {
      server = await startServer(buildApp("/auth", await loadAuthRouter()));
    });

    afterEach(async () => {
      await server.close();
    });

    it.each(["mobile", "web"])("mounts the %s router", async (name) => {
      const res = await server.get(`/auth/${name}/whoami`);
      expect(await res.json()).toEqual({ name });
    });

    describe("POST /resetPasswordToken", () => {
      it("requests a reset token and responds 204", async () => {
        const res = await server.post("/auth/resetPasswordToken", {
          email: "user@example.com",
        });
        expect(res.status).toBe(204);
        expect(h.service.requestPasswordResetToken).toHaveBeenCalledWith(
          "user@example.com",
        );
        expect(h.resetLimiter).toHaveBeenCalledTimes(1);
      });

      it("responds 400 for an invalid email", async () => {
        const res = await server.post("/auth/resetPasswordToken", {
          email: "nope",
        });
        expect(res.status).toBe(400);
        expect(h.service.requestPasswordResetToken).not.toHaveBeenCalled();
      });

      it("propagates service errors", async () => {
        vi.mocked(h.service.requestPasswordResetToken).mockRejectedValue(
          new NotFoundError("User email not found"),
        );
        const res = await server.post("/auth/resetPasswordToken", {
          email: "user@example.com",
        });
        expect(res.status).toBe(404);
      });
    });

    describe("POST /validateEmail", () => {
      it("responds 204 when the email is validated", async () => {
        vi.mocked(h.service.validateEmail).mockResolvedValue(true);
        const res = await server.post("/auth/validateEmail?token=abc");
        expect(res.status).toBe(204);
        expect(h.service.validateEmail).toHaveBeenCalledWith("abc");
      });

      it("responds 500 when validation reports failure", async () => {
        vi.mocked(h.service.validateEmail).mockResolvedValue(false);
        const res = await server.post("/auth/validateEmail?token=abc");
        expect(res.status).toBe(500);
      });

      it("passes undefined when no token is provided", async () => {
        vi.mocked(h.service.validateEmail).mockResolvedValue(false);
        await server.post("/auth/validateEmail");
        expect(h.service.validateEmail).toHaveBeenCalledWith(undefined);
      });

      it("responds 404 when the token is unknown", async () => {
        vi.mocked(h.service.validateEmail).mockRejectedValue(
          new NotFoundError("Account not found"),
        );
        const res = await server.post("/auth/validateEmail?token=abc");
        expect(res.status).toBe(404);
      });
    });

    describe("POST /requestEmailVerification", () => {
      it("requests verification and responds 204", async () => {
        const res = await server.post("/auth/requestEmailVerification", {
          email: "user@example.com",
        });
        expect(res.status).toBe(204);
        expect(h.service.requestEmailVerification).toHaveBeenCalledWith(
          "user@example.com",
        );
        expect(h.resetLimiter).toHaveBeenCalledTimes(1);
      });

      it("responds 400 for an invalid email", async () => {
        const res = await server.post("/auth/requestEmailVerification", {});
        expect(res.status).toBe(400);
        expect(h.service.requestEmailVerification).not.toHaveBeenCalled();
      });

      it("responds 400 when already verified", async () => {
        vi.mocked(h.service.requestEmailVerification).mockRejectedValue(
          new BadRequestError("Email already verified!"),
        );
        const res = await server.post("/auth/requestEmailVerification", {
          email: "user@example.com",
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toMatchObject({
          error: "bad_request",
          message: "Email already verified!",
        });
      });
    });
  });
});
