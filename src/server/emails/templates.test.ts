import { describe, it, expect } from "vitest";
import { escapeHtml, quoteRequestEmailHtml, newQuoteEmailHtml } from "./templates";

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
      dentistName: "<b>ד״ר</b>",
      patientName: `<img src=x onerror=alert(1)>`,
      patientPhone: "050-0000000",
      requestId: "abcdef12-3456",
      date: "1 בינואר 2026",
      quoteUrl: "https://example.com/quote/tok",
    });
    // Raw tags from user input must not appear; escaped entities must.
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>ד");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("escapes the patient name in the new-quote notification", () => {
    const html = newQuoteEmailHtml({ patientName: "<i>x</i>", link: "https://e/x" });
    expect(html).not.toContain("<i>x</i>");
    expect(html).toContain("&lt;i&gt;x&lt;/i&gt;");
  });
});
