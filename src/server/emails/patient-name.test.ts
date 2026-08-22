import { describe, it, expect } from "vitest";
import { newQuoteEmailHtml } from "./templates";
import he from "@/i18n/dictionaries/he";
import en from "@/i18n/dictionaries/en";

/**
 * The patient's name is not always known: sign-up asks for an email and a
 * password, and whether it asks for a name at all is a Clerk dashboard setting.
 * Before this, the gap was filled with the email address — which then greeted
 * the patient by their own email and told the dentist that was their name.
 */
describe("greeting a patient whose name we don't have", () => {
  const link = "https://dentalcompare.co.il/he/request/abc";

  it("greets by name when there is one", () => {
    const html = newQuoteEmailHtml({ locale: "he", t: he.emails, patientName: "דנה לוי", link });

    expect(html).toContain("שלום דנה לוי,");
  });

  // "שלום המטופל," addressed to the patient themselves reads worse than no name.
  it.each([
    ["he", he.emails, "שלום,"],
    ["en", en.emails, "Hello,"],
  ] as const)(
    "drops the name entirely rather than substituting one (%s)",
    (locale, t, greeting) => {
      const html = newQuoteEmailHtml({ locale, t, patientName: null, link });

      expect(html).toContain(greeting);
    },
  );

  it("never puts an email address where the name goes", () => {
    const html = newQuoteEmailHtml({
      locale: "he",
      t: he.emails,
      patientName: null,
      link,
    });

    expect(html).not.toMatch(/@/);
  });

  it("escapes a name rather than trusting it — it came from a sign-up form", () => {
    const html = newQuoteEmailHtml({
      locale: "he",
      t: he.emails,
      patientName: '<script>alert("x")</script>',
      link,
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
