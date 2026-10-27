import { describe, expect, it } from "vitest";
import { generateValidateEmailTemplate } from "@/feature/auth/email/templates/validateEmailTemplate";

describe("generateValidateEmailTemplate", () => {
  it("links to the validate email page with the token", () => {
    const html = generateValidateEmailTemplate("tok-9", "https://app.test");
    expect(html).toContain(
      'href="https://app.test/auth/validateEmail?token=tok-9"',
    );
  });

  it("renders the welcome copy and button", () => {
    const html = generateValidateEmailTemplate("t", "https://app.test");
    expect(html).toContain("Welcome to Infinite Sudoku!");
    expect(html).toContain(">Validate Email</span>");
  });
});
