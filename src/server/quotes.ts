"use server";

import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { asLocale } from "@/i18n/config";
import { RATE_LIMITS, QUOTE_INCLUSIONS, type QuoteInclusion } from "@/lib/constants";
import { toMinor } from "@/lib/money";

/** Keeps a submitted count inside a sane range instead of trusting the form. */
function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
import { sendNewQuoteEmail } from "./quote-notifications";

/**
 * Records a clinic's quote.
 *
 * `amountMajor` is what the clinic typed — 4000, not 400000. It is converted to
 * minor units here, once, against the currency of the clinic's own country: a
 * quote is always denominated where the treatment happens, and any conversion
 * into the patient's currency is display-only (see lib/money).
 */
export async function submitQuote(input: {
  token: string;
  amountMajor: number;
  note?: string;
  includes?: string[];
  tripsRequired?: number;
  daysPerTrip?: number;
  weeksBetweenTrips?: number | null;
  warrantyYears?: number | null;
  warrantyNote?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const rl = await rateLimit(
    `quote:${input.token}`,
    RATE_LIMITS.submitQuote.limit,
    RATE_LIMITS.submitQuote.windowMs,
  );
  if (!rl.allowed) {
    return { ok: false, error: e.tooManyAttempts };
  }

  // Bounds are checked in major units, the way the clinic entered them, so the
  // ceiling means the same thing whatever the currency's minor-unit scale is.
  const major = input.amountMajor;
  if (!Number.isFinite(major) || major <= 0 || major > 1_000_000) {
    return { ok: false, error: e.invalidPrice };
  }

  const rd = await db.requestDentist.findUnique({
    where: { quoteToken: input.token },
    select: {
      id: true,
      requestId: true,
      quote: { select: { id: true, status: true } },
      // The quote is denominated in the clinic's own country's currency.
      dentist: { select: { country: { select: { currency: true } } } },
      request: {
        select: { id: true, user: { select: { fullName: true, email: true, locale: true } } },
      },
    },
  });
  if (!rd) return { ok: false, error: e.invalidLink };
  if (rd.quote && rd.quote.status !== "PENDING_DECISION") {
    return { ok: false, error: e.quoteAlreadyDecided };
  }

  // A sibling quote on the same request may have already been approved (or
  // gone further) between the patient's decision and this submit — approval
  // is exclusive per request, so no other clinic may still create or edit a
  // quote once that has happened.
  const decidedSibling = await db.quote.findFirst({
    where: {
      requestDentist: { requestId: rd.requestId },
      status: { in: ["APPROVED", "IN_TREATMENT", "COMPLETION_REQUESTED", "COMPLETED"] },
    },
    select: { id: true },
  });
  if (decidedSibling) {
    return { ok: false, error: e.quoteAlreadyDecided };
  }

  const isNew = !rd.quote;
  const note = input.note?.trim() || null;
  const currency = rd.dentist.country.currency;
  const amountMinor = toMinor(major, currency);

  // Only canonical inclusion keys are stored, so the patient compares clinics
  // on the same axis instead of reading two differently-worded notes.
  const includes = (input.includes ?? []).filter((k): k is QuoteInclusion =>
    (QUOTE_INCLUSIONS as readonly string[]).includes(k),
  );

  const tripsRequired = clampInt(input.tripsRequired, 1, 1, 10);
  const daysPerTrip = clampInt(input.daysPerTrip, 1, 1, 60);
  // Only meaningful with more than one trip; forced null otherwise so the two
  // fields can never contradict each other.
  const weeksBetweenTrips =
    tripsRequired > 1 ? clampInt(input.weeksBetweenTrips, 1, 1, 104) : null;
  const warrantyYears =
    input.warrantyYears == null ? null : clampInt(input.warrantyYears, 0, 0, 50);
  const warrantyNote = input.warrantyNote?.trim() || null;

  let quoteId: string;
  if (isNew) {
    // No race risk here: a duplicate create would hit the `@unique`
    // constraint on `requestDentistId` and fail cleanly, which is acceptable
    // — two concurrent first-submits from the same clinic link is not a
    // scenario the spec needs to protect against.
    const quote = await db.quote.create({
      data: {
        requestDentistId: rd.id,
        amountMinor,
        currency,
        note,
        includes,
        tripsRequired,
        daysPerTrip,
        weeksBetweenTrips,
        warrantyYears,
        warrantyNote,
      },
      select: { id: true },
    });
    quoteId = quote.id;
  } else {
    // Conditional on the quote's own status, so a clinic's edit landing at
    // nearly the same instant as the patient's approval can't silently
    // overwrite the price on a quote that just got decided.
    const result = await db.quote.updateMany({
      where: { requestDentistId: rd.id, status: "PENDING_DECISION" },
      data: {
        amountMinor,
        currency,
        note,
        includes,
        tripsRequired,
        daysPerTrip,
        weeksBetweenTrips,
        warrantyYears,
        warrantyNote,
      },
    });
    if (result.count === 0) {
      return { ok: false, error: e.quoteAlreadyDecided };
    }
    quoteId = rd.quote!.id;
  }

  // Notify the patient — unless their account was deleted (user set to null),
  // in which case there is no address to notify. On a send failure we leave
  // patientNotifiedAt null so the daily retry cron picks it up later.
  if (isNew && rd.request.user) {
    const sent = await sendNewQuoteEmail({
      to: rd.request.user.email,
      patientName: rd.request.user.fullName,
      requestId: rd.request.id,
      locale: asLocale(rd.request.user.locale),
    });
    if (sent) {
      await db.quote.update({
        where: { id: quoteId },
        data: { patientNotifiedAt: new Date() },
      });
    }
  }

  return { ok: true };
}
