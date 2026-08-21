import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { asLocale } from "@/i18n/config";
import { sendNewQuoteEmail } from "@/server/quote-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Daily safety net for the patient "you got a new quote" email. Finds quotes
 * whose first notification never went out (patientNotifiedAt still null) more
 * than an hour after they were created, and retries. Setting patientNotifiedAt
 * on success makes this idempotent — a quote is notified at most once.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - ONE_HOUR_MS);
  const stuck = await db.quote.findMany({
    where: {
      patientNotifiedAt: null,
      createdAt: { lt: cutoff },
      requestDentist: { request: { userId: { not: null } } },
    },
    select: {
      id: true,
      requestDentist: {
        select: {
          request: {
            select: {
              id: true,
              user: { select: { fullName: true, email: true, locale: true } },
            },
          },
        },
      },
    },
  });

  let sent = 0;
  for (const q of stuck) {
    const user = q.requestDentist.request.user;
    if (!user) continue; // account deleted since — nothing to notify
    const ok = await sendNewQuoteEmail({
      to: user.email,
      patientName: user.fullName,
      requestId: q.requestDentist.request.id,
      locale: asLocale(user.locale),
    });
    if (ok) {
      await db.quote.update({ where: { id: q.id }, data: { patientNotifiedAt: new Date() } });
      sent += 1;
    }
  }

  return NextResponse.json({ checked: stuck.length, sent });
}
