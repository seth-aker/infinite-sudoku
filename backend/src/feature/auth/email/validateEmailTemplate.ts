import { baseEmailTemplate } from "./baseEmailTemplate";

export function generateValidateEmailTemplate(token: string, origin: string) {
  return baseEmailTemplate({
    buttonText: "Validate Email",
    link: `${origin}/auth/validate?token=${token}`,
    header: "Welcome to Infinite Sudoku! Please click the button below to verify your email.",
    footerText: "We have received a request to reset your Infinite Sudoku password. If you did not request this change, simply delete this email."
  })
}
