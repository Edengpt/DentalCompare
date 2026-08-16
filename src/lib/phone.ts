/**
 * Israeli mobile number handling.
 *
 * Phone verification is the qualification gate that replaced the removed patient
 * fee (PRD 4.2), so the value stored must be canonical: E.164, one row per real
 * number. Two spellings of the same number that both pass would let one person
 * open unlimited accounts and defeat the gate entirely.
 */

// Allocated Israeli mobile prefixes, without the leading 0. 057 is deliberately
// absent — it is not currently allocated.
const MOBILE_PREFIXES = ["50", "51", "52", "53", "54", "55", "56", "58", "59"];

/**
 * Returns the number as E.164 (+9725XXXXXXXX), or null if it isn't a valid
 * Israeli mobile. Accepts the local (05X…), international (+972…, 972…) and
 * dial-out (00972…) spellings, with or without separators.
 */
export function normalizeIsraeliMobile(input: string | null | undefined): string | null {
  if (!input) return null;

  // Strip everything except digits and a single leading +.
  const trimmed = input.trim();
  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  let national: string;
  if (digits.startsWith("00972")) {
    national = digits.slice(5);
  } else if (digits.startsWith("972")) {
    national = digits.slice(3);
  } else if (!hadPlus && digits.startsWith("0")) {
    national = digits.slice(1);
  } else {
    // A + on anything that isn't +972 is a foreign number.
    return null;
  }

  // National mobile form is 9 digits: prefix (2) + subscriber (7).
  if (national.length !== 9) return null;
  if (!MOBILE_PREFIXES.includes(national.slice(0, 2))) return null;

  return `+972${national}`;
}

/** Renders a stored E.164 number back as the local 05X-XXX-XXXX users recognise. */
export function formatIsraeliMobileForDisplay(e164: string | null | undefined): string {
  if (!e164) return "";
  const normalized = normalizeIsraeliMobile(e164);
  if (!normalized) return e164;
  const national = normalized.slice(4); // drop "+972"
  return `0${national.slice(0, 2)}-${national.slice(2, 5)}-${national.slice(5)}`;
}
