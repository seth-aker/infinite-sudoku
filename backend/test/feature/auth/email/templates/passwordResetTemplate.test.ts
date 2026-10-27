import { describe, expect, it } from "vitest";
import { generatePasswordResetEmailBody } from "@/feature/auth/email/templates/passwordResetTemplate";
import { baseEmailTemplate } from "@/feature/auth/email/templates/baseEmailTemplate";

describe("generatePasswordResetEmailBody", () => {
  it("links to the reset password page with the token", () => {
    const html = generatePasswordResetEmailBody("tok-123", "https://app.test");
    expect(html).toContain(
      'href="https://app.test/auth/reset-password?token=tok-123"',
    );
  });

  it("renders the reset password copy using the base template", () => {
    const html = generatePasswordResetEmailBody("t", "https://app.test");
    expect(html).toBe(
      baseEmailTemplate({
        footerText:
          "You can also reset your password by pasting this URL into a web browser.",
        buttonText: "Reset Password",
        link: "https://app.test/auth/reset-password?token=t",
        header:
          "We have received a request to reset your Infinite Sudoku password. If you did not request this change, simply delete this email.",
      }),
    );
  });
});
