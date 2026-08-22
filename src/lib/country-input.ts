import { isSupportedCurrency } from "./money";
import { isLocale, type Locale } from "@/i18n/config";

/**
 * Validation for admin-entered country data.
 *
 * A country is the root of a market rather than a label on one. Its currency
 * prices every quote written in it, its calling code parses every phone number
 * typed there, and its insurer list is the entire payer vocabulary a clinic in
 * that country is offered. A typo here does not look like a typo — it looks
 * like a market that quietly misbehaves — so parsing is strict and every
 * failure names the field that caused it.
 *
 * Deliberately free of database and server-only imports, so it can be tested in
 * the node environment and reused by both the create and the activate paths.
 */

export type RawCountryInput = {
  code: string;
  nameEn: string;
  currency: string;
  callingCode: string;
  defaultLocale: string;
  insurers: string;
  requiredDocs: string;
};

export type CountryField = keyof RawCountryInput;

export type ParsedCountry = {
  code: string;
  nameEn: string;
  currency: string;
  callingCode: string;
  defaultLocale: Locale;
  insurers: string[];
  requiredDocs: string[];
};

export type ParseResult = { ok: true; value: ParsedCountry } | { ok: false; field: CountryField };

/**
 * Comma-separated free text to a clean list.
 *
 * De-duplication is case-insensitive because "Clalit" and "clalit" are one
 * payer, and two of them render as two identical checkboxes in the clinic
 * form. The first spelling wins, so the admin's capitalisation is what users
 * see.
 */
function toList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw.split(",")) {
    const value = entry.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function parseCountryInput(raw: RawCountryInput): ParseResult {
  const code = raw.code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return { ok: false, field: "code" };

  const nameEn = raw.nameEn.trim();
  if (!nameEn) return { ok: false, field: "nameEn" };

  const currency = raw.currency.trim().toUpperCase();
  if (!isSupportedCurrency(currency)) return { ok: false, field: "currency" };

  // Admins copy calling codes off a webpage, where they are written "+36".
  const callingCode = raw.callingCode.trim().replace(/^\+/, "");
  if (!/^\d{1,4}$/.test(callingCode)) return { ok: false, field: "callingCode" };

  // A locale the site cannot serve would render that country's pages against a
  // dictionary that does not exist.
  const defaultLocale = raw.defaultLocale.trim();
  if (!isLocale(defaultLocale)) return { ok: false, field: "defaultLocale" };

  return {
    ok: true,
    value: {
      code,
      nameEn,
      currency,
      callingCode,
      defaultLocale,
      insurers: toList(raw.insurers),
      requiredDocs: toList(raw.requiredDocs),
    },
  };
}
