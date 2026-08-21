import { describe, it, expect } from "vitest";
import { escapeHtml, quoteRequestEmailHtml, newQuoteEmailHtml } from "./templates";
import he from "@/i18n/dictionaries/he";
import en from "@/i18n/dictionaries/en";

describe("escapeHtml", () => {
  it("escapes all HTML-special characters", () => {
    expect(escapeHtml(`<script>"&'`)).toBe("&lt;script&gt;&quot;&amp;&#39;");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("דנה כהן")).toBe("דנה כהן");
  });
});

describe("email templates escape user input", () => {
  it("neutralizes markup in the patient/dentist names of a quote request", () => {
    const html = quoteRequestEmailHtml({
      locale: "he",
      t: he.emails,
      dentistName: "<b>ד״ר</b>",
      patientName: `<img src=x onerror=alert(1)>`,
      patientPhone: "050-0000000",
      phoneVerified: true,
      requestId: "abcdef12-3456",
      date: "1 בינואר 2026",
      quoteUrl: "https://example.com/quote/tok",
    });
    // Raw tags from user input must not appear; escaped entities must.
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>ד");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  // Verification is optional, so the clinic must be able to tell the two apart —
  // an unverified number silently presented as fact is worse than no claim.
  it("labels the phone as verified or not", () => {
    const base = {
      locale: "he" as const,
      t: he.emails,
      dentistName: "ד״ר כהן",
      patientName: "דנה",
      patientPhone: "050-1234567",
      requestId: "abcdef12-3456",
      date: "1 בינואר 2026",
      quoteUrl: "https://example.com/quote/tok",
    };
    expect(quoteRequestEmailHtml({ ...base, phoneVerified: true })).toContain(
      he.emails.smsVerified,
    );
    const unverified = quoteRequestEmailHtml({ ...base, phoneVerified: false });
    expect(unverified).toContain(he.emails.smsNotVerified);
    expect(unverified).not.toContain(he.emails.smsVerified);
  });

  it("escapes the patient name in the new-quote notification", () => {
    const html = newQuoteEmailHtml({
      locale: "he",
      t: he.emails,
      patientName: "<i>x</i>",
      link: "https://e/x",
    });
    expect(html).not.toContain("<i>x</i>");
    expect(html).toContain("&lt;i&gt;x&lt;/i&gt;");
  });
});

describe("email templates follow the recipient's language", () => {
  const base = {
    dentistName: "Dr Cohen",
    patientName: "Dana",
    patientPhone: "+447911123456",
    phoneVerified: true,
    requestId: "abcdef12-3456",
    date: "1 January 2026",
    quoteUrl: "https://example.com/quote/tok",
  };

  it("renders right-to-left for Hebrew and left-to-right for English", () => {
    // Direction is not cosmetic here: an English email rendered RTL is unreadable
    // in a way that no amount of correct wording fixes.
    expect(quoteRequestEmailHtml({ ...base, locale: "he", t: he.emails })).toContain('dir="rtl"');
    expect(quoteRequestEmailHtml({ ...base, locale: "en", t: en.emails })).toContain('dir="ltr"');
  });

  it("uses the English copy for an English recipient", () => {
    const html = quoteRequestEmailHtml({ ...base, locale: "en", t: en.emails });
    expect(html).toContain("has asked you for a quote");
    expect(html).toContain(en.emails.autoFooter);
    // No Hebrew should survive into an English email.
    expect(html).not.toMatch(/[֐-׿]/);
  });

  it("uses the Hebrew copy for a Hebrew recipient", () => {
    const html = quoteRequestEmailHtml({ ...base, locale: "he", t: he.emails });
    expect(html).toContain(he.emails.autoFooter);
    expect(html).toMatch(/[֐-׿]/);
  });

  it("interpolates the patient name into the heading in both languages", () => {
    expect(quoteRequestEmailHtml({ ...base, locale: "en", t: en.emails })).toContain("Dana has");
    expect(quoteRequestEmailHtml({ ...base, locale: "he", t: he.emails })).toContain("Dana ביקש");
  });
});
