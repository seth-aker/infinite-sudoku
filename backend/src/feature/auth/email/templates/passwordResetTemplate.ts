import { baseEmailTemplate } from "./baseEmailTemplate";

export function generatePasswordResetEmailBody(token: string, origin: string): string {
  const html = baseEmailTemplate({
    footerText: "You can also reset your password by pasting this URL into a web browser.",
    buttonText: "Reset Password",
    link: `${origin}/auth/reset-password?token=${token}`,
    header: "We have received a request to reset your Infinite Sudoku password. If you did not request this change, simply delete this email."
  })
  return html
}
