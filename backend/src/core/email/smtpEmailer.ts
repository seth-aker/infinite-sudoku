import { config } from "@/core/config";
import { logger } from "@/core/logging/logger";
import nodemailer, { SendMailOptions, Transporter } from "nodemailer";

export class Emailer implements Emailer {
  private _transporter: Transporter;
  constructor(transporter: Transporter) {
    this._transporter = transporter;
  }

  async sendMail(data: SendMailOptions) {
    const result = await this._transporter.sendMail(data);
    if(!config.isProduction) {
      const message = nodemailer.getTestMessageUrl(result);
      logger.debug(`Email preview: ${message}`);
    }
    return result;
  };
}
