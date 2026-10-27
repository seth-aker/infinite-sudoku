import { afterEach, describe, expect, it, vi } from "vitest";
import nodemailer, { type Transporter } from "nodemailer";
import { Emailer } from "@/feature/auth/email/smtpEmailer";
import { config } from "@/core/config";
import { logger } from "@/core/logging/logger";

function fakeTransporter(sendMail = vi.fn()) {
  return { sendMail } as unknown as Transporter & { sendMail: typeof sendMail };
}

const mail = { to: "a@b.c", subject: "hi", html: "<p>hi</p>" };

describe("Emailer", () => {
  const originalIsProduction = config.isProduction;

  afterEach(() => {
    config.isProduction = originalIsProduction;
  });

  it("sends mail through the transporter and returns the result", async () => {
    const info = { messageId: "abc" };
    const transporter = fakeTransporter(vi.fn().mockResolvedValue(info));
    const emailer = new Emailer(transporter);

    await expect(emailer.sendMail(mail)).resolves.toBe(info);
    expect(transporter.sendMail).toHaveBeenCalledWith(mail);
  });

  it("logs a preview url outside production", async () => {
    config.isProduction = false;
    const info = { messageId: "abc" };
    vi.spyOn(nodemailer, "getTestMessageUrl").mockReturnValue(
      "https://preview.test/abc",
    );
    const emailer = new Emailer(
      fakeTransporter(vi.fn().mockResolvedValue(info)),
    );

    await emailer.sendMail(mail);

    expect(nodemailer.getTestMessageUrl).toHaveBeenCalledWith(info);
    expect(logger.debug).toHaveBeenCalledWith(
      "Email preview: https://preview.test/abc",
    );
  });

  it("does not log a preview url in production", async () => {
    config.isProduction = true;
    const spy = vi.spyOn(nodemailer, "getTestMessageUrl");
    const emailer = new Emailer(fakeTransporter(vi.fn().mockResolvedValue({})));

    await emailer.sendMail(mail);

    expect(spy).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it("propagates transporter failures", async () => {
    const emailer = new Emailer(
      fakeTransporter(vi.fn().mockRejectedValue(new Error("smtp down"))),
    );
    await expect(emailer.sendMail(mail)).rejects.toThrow("smtp down");
    expect(logger.debug).not.toHaveBeenCalled();
  });
});
