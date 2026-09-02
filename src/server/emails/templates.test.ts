import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  quoteRequestEmailHtml,
  newQuoteEmailHtml,
  trialEndingEmailHtml,
  documentsRejectedEmailHtml,
  quoteApprovedEmailHtml,
  quoteRejectedEmailHtml,
  treatmentStartedEmailHtml,
  completionRequestedEmailHtml,
  treatmentCompletedEmailHtml,
} from "./templates";
import he from "@/i18n/dictionaries/he";
import en from "@/i18n/dictionaries/en";
import { getDictionary } from "@/i18n/get-dictionary";

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

// A clinic starts its trial the moment an admin approves it — payment setup is a
// separate link it may never click. So "we will charge the card you saved" is
// false for a large share of trialing clinics, and this is the one email they
// are guaranteed to read before the trial ends.
describe("the trial-ending email tells the truth about the card", () => {
  const base = {
    locale: "he" as const,
    t: he.emails,
    clinicName: "מרפאת בדיקה",
    daysRemaining: 2,
    priceMinor: 29900,
    currency: "ILS",
    planLabel: "חודשי",
  };

  it("announces the charge when a card is on file", () => {
    const html = trialEndingEmailHtml({ ...base, setupUrl: null });
    expect(html).toContain(he.emails.trialBody.split("{")[0].trim().slice(0, 12));
    expect(html).not.toContain(he.emails.trialSetupCta);
  });

  it("asks for payment setup, with a link, when no card was ever stored", () => {
    const html = trialEndingEmailHtml({
      ...base,
      setupUrl: "https://example.com/he/clinics/billing/stk_1",
    });
    expect(html).toContain("https://example.com/he/clinics/billing/stk_1");
    expect(html).toContain(he.emails.trialSetupCta);
    // The false promise must be gone, not merely accompanied by the CTA.
    expect(html).not.toContain(he.emails.trialNoAction);
  });

  it("keeps the same distinction in English", () => {
    const html = trialEndingEmailHtml({
      ...base,
      locale: "en",
      t: en.emails,
      setupUrl: "https://example.com/en/clinics/billing/stk_1",
    });
    expect(html).toContain(en.emails.trialSetupCta);
    expect(html).not.toContain(en.emails.trialNoAction);
  });
});

describe("the rejected-documents email", () => {
  const base = {
    locale: "he" as const,
    t: he.emails,
    clinicName: "מרפאת בדיקה",
    link: "https://example.com/he/clinics/documents/tok_1",
  };

  it("names each document and why it was refused", () => {
    const html = documentsRejectedEmailHtml({
      ...base,
      items: [{ kind: "Licence", reason: "התמונה מטושטשת" }],
    });
    expect(html).toContain("Licence");
    expect(html).toContain("התמונה מטושטשת");
    expect(html).toContain(base.link);
  });

  // The reason is free text an admin typed, and the kind came from a country
  // row an admin typed. Both reach an email as markup.
  it("escapes the admin's reason, the document kind and the clinic's name", () => {
    const html = documentsRejectedEmailHtml({
      ...base,
      clinicName: "<b>Clinic</b>",
      items: [{ kind: "<img src=x onerror=alert(1)>", reason: "<script>bad()</script>" }],
    });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>bad()");
    expect(html).not.toContain("<b>Clinic</b>");
  });
});

describe("quote lifecycle email templates", () => {
  it("renders the clinic's name into the approval email", async () => {
    const t = (await getDictionary("he")).emails;
    const html = quoteApprovedEmailHtml({
      locale: "he",
      t,
      clinicName: "מרפאת בדיקה",
      link: "https://example.com/clinics/dashboard",
    });
    expect(html).toContain("מרפאת בדיקה");
    expect(html).toContain("https://example.com/clinics/dashboard");
  });

  it("renders the rejection email without claiming approval", async () => {
    const t = (await getDictionary("he")).emails;
    const html = quoteRejectedEmailHtml({
      locale: "he",
      t,
      clinicName: "מרפאת בדיקה",
      link: "https://example.com/clinics/dashboard",
    });
    expect(html).toContain("מרפאת בדיקה");
  });

  it("greets the patient by name when one is on file, and omits it otherwise", async () => {
    const t = (await getDictionary("he")).emails;
    const withName = treatmentStartedEmailHtml({
      locale: "he",
      t,
      patientName: "דנה",
      clinicName: "מרפאת בדיקה",
      link: "https://example.com/request/abc",
    });
    expect(withName).toContain("דנה");

    const withoutName = treatmentStartedEmailHtml({
      locale: "he",
      t,
      patientName: null,
      clinicName: "מרפאת בדיקה",
      link: "https://example.com/request/abc",
    });
    expect(withoutName).not.toContain("null");
  });

  it("asks the patient to confirm completion with a working link", async () => {
    const t = (await getDictionary("he")).emails;
    const html = completionRequestedEmailHtml({
      locale: "he",
      t,
      patientName: "דנה",
      clinicName: "מרפאת בדיקה",
      link: "https://example.com/request/abc",
    });
    expect(html).toContain("https://example.com/request/abc");
  });

  it("tells the clinic the patient confirmed completion", async () => {
    const t = (await getDictionary("he")).emails;
    const html = treatmentCompletedEmailHtml({
      locale: "he",
      t,
      clinicName: "מרפאת בדיקה",
      link: "https://example.com/clinics/dashboard",
    });
    expect(html).toContain("מרפאת בדיקה");
  });

  // Escaping regression tests: ensure HTML-special characters in clinic/patient
  // names are escaped, not injected as raw markup.
  it("escapes the clinic name in the approval email", async () => {
    const t = (await getDictionary("he")).emails;
    const html = quoteApprovedEmailHtml({
      locale: "he",
      t,
      clinicName: "<script>alert(1)</script>",
      link: "https://example.com/clinics/dashboard",
    });
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes the clinic name in the rejection email", async () => {
    const t = (await getDictionary("he")).emails;
    const html = quoteRejectedEmailHtml({
      locale: "he",
      t,
      clinicName: "<img src=x onerror=alert(1)>",
      link: "https://example.com/clinics/dashboard",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("escapes the clinic name in the treatment started email", async () => {
    const t = (await getDictionary("he")).emails;
    const html = treatmentStartedEmailHtml({
      locale: "he",
      t,
      patientName: "דנה",
      clinicName: "<b>Clinic</b>",
      link: "https://example.com/request/abc",
    });
    expect(html).not.toContain("<b>Clinic</b>");
    expect(html).toContain("&lt;b&gt;Clinic&lt;/b&gt;");
  });

  it("escapes the patient name in the treatment started email", async () => {
    const t = (await getDictionary("he")).emails;
    const html = treatmentStartedEmailHtml({
      locale: "he",
      t,
      patientName: "<script>bad()</script>",
      clinicName: "מרפאת בדיקה",
      link: "https://example.com/request/abc",
    });
    expect(html).not.toContain("<script>bad()");
    expect(html).toContain("&lt;script&gt;bad()&lt;/script&gt;");
  });

  it("escapes the clinic name in the completion requested email", async () => {
    const t = (await getDictionary("he")).emails;
    const html = completionRequestedEmailHtml({
      locale: "he",
      t,
      patientName: "דנה",
      clinicName: "<img src=x onerror=alert(1)>",
      link: "https://example.com/request/abc",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("escapes the patient name in the completion requested email", async () => {
    const t = (await getDictionary("he")).emails;
    const html = completionRequestedEmailHtml({
      locale: "he",
      t,
      patientName: "<b>Patient</b>",
      clinicName: "מרפאת בדיקה",
      link: "https://example.com/request/abc",
    });
    expect(html).not.toContain("<b>Patient</b>");
    expect(html).toContain("&lt;b&gt;Patient&lt;/b&gt;");
  });

  it("escapes the clinic name in the treatment completed email", async () => {
    const t = (await getDictionary("he")).emails;
    const html = treatmentCompletedEmailHtml({
      locale: "he",
      t,
      clinicName: "<script>alert(1)</script>",
      link: "https://example.com/clinics/dashboard",
    });
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
