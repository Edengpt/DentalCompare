import { describe, it, expect } from "vitest";
import { parseCountryInput } from "./country-input";

const valid = {
  code: "TR",
  nameEn: "Türkiye",
  currency: "TRY",
  callingCode: "90",
  defaultLocale: "en",
  insurers: "",
  requiredDocs: "",
};

function parse(overrides: Partial<typeof valid> = {}) {
  return parseCountryInput({ ...valid, ...overrides });
}

describe("parseCountryInput", () => {
  it("accepts a well-formed country", () => {
    const result = parse();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.code).toBe("TR");
  });

  describe("code", () => {
    it("upper-cases and trims", () => {
      const result = parse({ code: " hu " });
      expect(result.ok && result.value.code).toBe("HU");
    });

    it.each(["", "H", "HUN", "H1", "12"])("rejects %o", (code) => {
      expect(parse({ code })).toEqual({ ok: false, field: "code" });
    });
  });

  describe("nameEn", () => {
    it("trims", () => {
      const result = parse({ nameEn: "  Hungary  " });
      expect(result.ok && result.value.nameEn).toBe("Hungary");
    });

    it.each(["", "   "])("rejects %o", (nameEn) => {
      expect(parse({ nameEn })).toEqual({ ok: false, field: "nameEn" });
    });
  });

  describe("currency", () => {
    it("upper-cases and trims", () => {
      const result = parse({ currency: " huf " });
      expect(result.ok && result.value.currency).toBe("HUF");
    });

    it.each(["", "HU", "FORINT", "12"])("rejects %o", (currency) => {
      expect(parse({ currency })).toEqual({ ok: false, field: "currency" });
    });
  });

  describe("callingCode", () => {
    // Admins copy these off a webpage, where they are written "+36".
    it("strips a leading plus and surrounding space", () => {
      const result = parse({ callingCode: " +36 " });
      expect(result.ok && result.value.callingCode).toBe("36");
    });

    it.each(["", "+", "abc", "1a", "12345"])("rejects %o", (callingCode) => {
      expect(parse({ callingCode })).toEqual({ ok: false, field: "callingCode" });
    });
  });

  describe("defaultLocale", () => {
    // A locale the site cannot serve would render the country's clinics in a
    // language with no dictionary behind it.
    it.each(["", "pt", "EN"])("rejects %o", (defaultLocale) => {
      expect(parse({ defaultLocale })).toEqual({ ok: false, field: "defaultLocale" });
    });

    it.each(["he", "en"])("accepts %o", (defaultLocale) => {
      expect(parse({ defaultLocale }).ok).toBe(true);
    });
  });

  describe("list fields", () => {
    it("splits on commas, trimming and dropping blanks", () => {
      const result = parse({ insurers: " Clalit ,Maccabi ,, Meuhedet " });
      expect(result.ok && result.value.insurers).toEqual(["Clalit", "Maccabi", "Meuhedet"]);
    });

    // Empty is legitimate: not every country has an insurer concept, and a
    // country with no required documents is one an admin approves on sight.
    it.each(["", "   ", ",,"])("treats %o as an empty list", (insurers) => {
      const result = parse({ insurers });
      expect(result.ok && result.value.insurers).toEqual([]);
    });

    // A repeated payer renders as two identical checkboxes in the clinic form,
    // and "Clalit" typed twice with different capitalisation is one payer.
    it("de-duplicates case-insensitively, keeping the first spelling", () => {
      const result = parse({ requiredDocs: "Licence, licence , LICENCE, Insurance" });
      expect(result.ok && result.value.requiredDocs).toEqual(["Licence", "Insurance"]);
    });
  });
});
