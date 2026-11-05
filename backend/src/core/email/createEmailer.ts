import { createTransport } from "nodemailer";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import type { AppConfig } from "@/core/config";
import { Emailer } from "./smtpEmailer";

type EmailConfig = Pick<
  AppConfig,
  | "isProduction"
  | "sesAccessKeyId"
  | "sesSecretAccessKey"
  | "etherealUser"
  | "etherealPass"
>;

export function createEmailer(config: EmailConfig): Emailer {
  const transporter = config.isProduction
    ? createTransport({
      SES: {
        sesClient: new SESv2Client({
          region: "us-east-1",
          credentials: {
            accessKeyId: config.sesAccessKeyId,
            secretAccessKey: config.sesSecretAccessKey,
          },
        }),
        SendEmailCommand,
      },
    })
    : createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: config.etherealUser, pass: config.etherealPass },
    });

  return new Emailer(transporter);
}
