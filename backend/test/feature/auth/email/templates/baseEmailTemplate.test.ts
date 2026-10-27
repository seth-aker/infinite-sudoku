import { describe, expect, it } from "vitest";
import { baseEmailTemplate } from "@/feature/auth/email/templates/baseEmailTemplate";

const options = {
  header: "HEADER_TEXT",
  buttonText: "BUTTON_TEXT",
  link: "https://example.test/path?token=abc",
  footerText: "FOOTER_TEXT",
};

describe("baseEmailTemplate", () => {
  it("returns an html table", () => {
    const html = baseEmailTemplate(options);
    expect(html.startsWith("<table")).toBe(true);
    expect(html.trimEnd().endsWith("</table>")).toBe(true);
  });

  it("injects header, button text and footer text", () => {
    const html = baseEmailTemplate(options);
    expect(html).toContain("HEADER_TEXT");
    expect(html).toContain(">BUTTON_TEXT</span>");
    expect(html).toContain("FOOTER_TEXT");
  });

  it("uses the link for the button and the footer anchor", () => {
    const html = baseEmailTemplate(options);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual([options.link, options.link]);
    expect(html).toContain(`>${options.link}</a>`);
  });

  it("orders header before button before footer", () => {
    const html = baseEmailTemplate(options);
    const header = html.indexOf("HEADER_TEXT");
    const button = html.indexOf("BUTTON_TEXT");
    const footer = html.indexOf("FOOTER_TEXT");
    expect(header).toBeLessThan(button);
    expect(button).toBeLessThan(footer);
  });
});
