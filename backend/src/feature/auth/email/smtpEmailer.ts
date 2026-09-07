import { config } from "@/core/config";
import { createTransport } from "nodemailer";

export const transporter = createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: false,
  auth: {
    user: config.smtpUser,
    pass: config.smtpPassword,
  }
})
