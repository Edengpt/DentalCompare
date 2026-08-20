"use server";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { toMinor, legacyMajor } from "@/lib/money";
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
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const rl = await rateLimit(
    `quote:${input.token}`,
    RATE_LIMITS.submitQuote.limit,
    RATE_LIMITS.submitQuote.windowMs,
  );
  if (!rl.allowed) {
    return { ok: false, error: "יותר מדי ניסיונות. נסו שוב מאוחר יותר." };
  }

  // Bounds are checked in major units, the way the clinic entered them, so the
  // ceiling means the same thing whatever the currency's minor-unit scale is.
  const major = input.amountMajor;
  if (!Number.isFinite(major) || major <= 0 || major > 1_000_000) {
    return { ok: false, error: "יש להזין מחיר תקין" };
  }

  const rd = await db.requestDentist.findUnique({
    where: { quoteToken: input.token },
    select: {
      id: true,
      quote: { select: { id: true } },
      // The quote is denominated in the clinic's own country's currency.
      dentist: { select: { country: { select: { currency: true } } } },
      request: {
        select: { id: true, user: { select: { fullName: true, email: true } } },
      },
    },
  });
  if (!rd) return { ok: false, error: "קישור לא תקין" };

  const isNew = !rd.quote;
  const note = input.note?.trim() || null;
  const currency = rd.dentist.country.currency;
  const amountMinor = toMinor(major, currency);

  const quote = await db.quote.upsert({
    where: { requestDentistId: rd.id },
    // amountILS is a legacy mirror, unread since M3 and dropped in M4. It stays
    // written so a rollback to the pre-M3 code loses nothing.
    create: {
      requestDentistId: rd.id,
      amountMinor,
      currency,
      amountILS: legacyMajor(amountMinor, currency),
      note,
    },
    update: {
      amountMinor,
      currency,
      amountILS: legacyMajor(amountMinor, currency),
      note,
    },
    select: { id: true },
  });

  // Notify the patient — unless their account was deleted (user set to null),
  // in which case there is no address to notify. On a send failure we leave
  // patientNotifiedAt null so the daily retry cron picks it up later.
  if (isNew && rd.request.user) {
    const sent = await sendNewQuoteEmail({
      to: rd.request.user.email,
      patientName: rd.request.user.fullName,
      requestId: rd.request.id,
    });
    if (sent) {
      await db.quote.update({
        where: { id: quote.id },
        data: { patientNotifiedAt: new Date() },
      });
    }
  }

  return { ok: true };
}
