import { parsePhoneNumberWithError, type CountryCode } from "libphonenumber-js/mobile";

/**
 * Phone number handling, international.
 *
 * This was Israel-only: anything that wasn't +972 was rejected outright, which
 * made it impossible for a foreign clinic or patient to register at all. The
 * canonical stored form is still E.164 — one row per real number — because two
 * spellings of the same number both passing would let one person open unlimited
 * accounts and defeat the qualification gate (PRD 4.2).
 */

/**
 * Mobile-only is a product rule: a clinic calling back a landline isn't the
 * qualification gate we want, and the SMS OTP needs a handset.
 *
 * The import above is `libphonenumber-js/mobile`, not the package root, and
 * that choice IS the rule — in this metadata bundle `isValid()` already means
 * "is a mobile", so no type check is needed. The two alternatives both fail:
 *
 *   - the default (`min`) bundle returns `getType() === undefined` for Israeli
 *     numbers, so every Israeli landline would sail through;
 *   - the `max` bundle classifies correctly but is far larger, and the extra
 *     precision buys nothing here.
 *
 * It also settles the US on its own: American ranges are shared between
 * landline and mobile (FIXED_LINE_OR_MOBILE), and the mobile bundle counts
 * those as valid rather than locking out every US patient.
 */

/**
 * Country used to read a locally-formatted number when we don't yet know where
 * the person is.
 *
 * A local spelling like "050-555-5555" is meaningless without one — the parser
 * returns null, which would break the Israeli patient flow that types exactly
 * that. Every patient is Israeli today, so IL is correct; once User.countryCode
 * lands (P0 Task 2) callers pass that instead and this constant goes away.
 */
export const FALLBACK_PHONE_COUNTRY = "IL";

/**
 * Returns the number as E.164, or null if it isn't a usable mobile.
 *
 * `country` is a hint for reading local-format input (`05X…` as Israeli,
 * `07X…` as British). An explicit international prefix always wins over it, so
 * a wrong hint can't corrupt a number the caller already spelled out in full.
 */
export function normalizePhone(input: string | null | undefined, country?: string): string | null {
  if (!input?.trim()) return null;

  try {
    const parsed = parsePhoneNumberWithError(input, country as CountryCode | undefined);
    return parsed.isValid() ? parsed.number : null;
  } catch {
    return null;
  }
}

/** Renders a stored E.164 number in its own country's national format. */
export function formatPhoneForDisplay(e164: string | null | undefined): string {
  if (!e164) return "";
  try {
    const parsed = parsePhoneNumberWithError(e164);
    return parsed.isValid() ? parsed.formatNational() : e164;
  } catch {
    return e164;
  }
}

/**
 * The country a stored E.164 number belongs to, or null if it can't be read.
 *
 * Used to pre-fill the "where do you live" question rather than to answer it.
 * The distinction matters: an Israeli living in London keeps an Israeli mobile,
 * so a number is a good guess and a bad conclusion — and this value decides
 * which currency prices appear in and which privacy regime applies.
 */
export function countryFromPhone(e164: string | null | undefined): string | null {
  if (!e164) return null;
  try {
    return parsePhoneNumberWithError(e164).country ?? null;
  } catch {
    return null;
  }
}
