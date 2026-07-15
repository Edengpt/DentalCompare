"use server";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { sendNewQuoteEmail } from "./quote-notifications";

export async function submitQuote(input: {
  token: string;
  amountILS: number;
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

  const amount = Math.round(input.amountILS);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return { ok: false, error: "יש להזין מחיר תקין" };
  }

  const rd = await db.requestDentist.findUnique({
    where: { quoteToken: input.token },
    select: {
      id: true,
      quote: { select: { id: true } },
      request: {
        select: { id: true, user: { select: { fullName: true, email: true } } },
      },
    },
  });
  if (!rd) return { ok: false, error: "קישור לא תקין" };

  const isNew = !rd.quote;
  const note = input.note?.trim() || null;

  const quote = await db.quote.upsert({
    where: { requestDentistId: rd.id },
    create: { requestDentistId: rd.id, amountILS: amount, note },
    update: { amountILS: amount, note },
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
