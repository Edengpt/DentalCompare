"use server";

import { db } from "@/lib/db";
import { sendNewQuoteEmail } from "./quote-notifications";

export async function submitQuote(input: {
  token: string;
  amountILS: number;
  note?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
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

  await db.quote.upsert({
    where: { requestDentistId: rd.id },
    create: { requestDentistId: rd.id, amountILS: amount, note },
    update: { amountILS: amount, note },
  });

  if (isNew) {
    try {
      await sendNewQuoteEmail({
        to: rd.request.user.email,
        patientName: rd.request.user.fullName,
        requestId: rd.request.id,
      });
    } catch (err) {
      console.error("sendNewQuoteEmail failed:", err);
    }
  }

  return { ok: true };
}
