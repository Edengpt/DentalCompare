import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { asLocale } from "@/i18n/config";
import { sendNewQuoteEmail } from "@/server/quote-notifications";
import {
  sendQuoteApprovedEmail,
  sendQuoteRejectedEmail,
  sendTreatmentStartedEmail,
  sendCompletionRequestedEmail,
  sendTreatmentCompletedEmail,
} from "@/server/quote-decision-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Daily safety net for the five quote-lifecycle notifications. Each has its
 * own `*NotifiedAt` column, set only on a successful send — so a quote whose
 * first send attempt failed (network blip, provider outage) stays claimable
 * here, more than an hour after the event it should have been notified for.
 * Setting the column on success makes every block idempotent — a given
 * notification goes out at most once.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - ONE_HOUR_MS);
  let sent = 0;

  // 1. New-quote notification to the patient (existing behavior, unchanged).
  const stuckNewQuote = await db.quote.findMany({
    where: {
      patientNotifiedAt: null,
      createdAt: { lt: cutoff },
      requestDentist: { request: { userId: { not: null } } },
    },
    select: {
      id: true,
      requestDentist: {
        select: {
          request: { select: { id: true, user: { select: { fullName: true, email: true, locale: true } } } },
        },
      },
    },
  });
  for (const q of stuckNewQuote) {
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

  // 2. Decision notification (approved or rejected) to the clinic.
  const stuckDecision = await db.quote.findMany({
    where: {
      decisionNotifiedAt: null,
      decidedAt: { lt: cutoff },
      status: { in: ["APPROVED", "REJECTED"] },
    },
    select: {
      id: true,
      status: true,
      requestDentist: { select: { dentist: { select: { email: true, locale: true, clinicName: true } } } },
    },
  });
  for (const q of stuckDecision) {
    const dentist = q.requestDentist.dentist;
    const send = q.status === "APPROVED" ? sendQuoteApprovedEmail : sendQuoteRejectedEmail;
    const ok = await send({ to: dentist.email, clinicName: dentist.clinicName, locale: asLocale(dentist.locale) });
    if (ok) {
      await db.quote.update({ where: { id: q.id }, data: { decisionNotifiedAt: new Date() } });
      sent += 1;
    }
  }

  // 3. Treatment-started notification to the patient.
  const stuckStarted = await db.quote.findMany({
    where: { treatmentStartedNotifiedAt: null, treatmentStartedAt: { lt: cutoff } },
    select: {
      id: true,
      requestDentist: {
        select: {
          requestId: true,
          dentist: { select: { clinicName: true } },
          request: { select: { user: { select: { fullName: true, email: true, locale: true } } } },
        },
      },
    },
  });
  for (const q of stuckStarted) {
    const user = q.requestDentist.request.user;
    if (!user) continue;
    const ok = await sendTreatmentStartedEmail({
      to: user.email,
      patientName: user.fullName,
      clinicName: q.requestDentist.dentist.clinicName,
      requestId: q.requestDentist.requestId,
      locale: asLocale(user.locale),
    });
    if (ok) {
      await db.quote.update({ where: { id: q.id }, data: { treatmentStartedNotifiedAt: new Date() } });
      sent += 1;
    }
  }

  // 4. Completion-requested notification to the patient.
  const stuckCompletionRequested = await db.quote.findMany({
    where: { completionRequestedNotifiedAt: null, completionRequestedAt: { lt: cutoff } },
    select: {
      id: true,
      requestDentist: {
        select: {
          requestId: true,
          dentist: { select: { clinicName: true } },
          request: { select: { user: { select: { fullName: true, email: true, locale: true } } } },
        },
      },
    },
  });
  for (const q of stuckCompletionRequested) {
    const user = q.requestDentist.request.user;
    if (!user) continue;
    const ok = await sendCompletionRequestedEmail({
      to: user.email,
      patientName: user.fullName,
      clinicName: q.requestDentist.dentist.clinicName,
      requestId: q.requestDentist.requestId,
      locale: asLocale(user.locale),
    });
    if (ok) {
      await db.quote.update({ where: { id: q.id }, data: { completionRequestedNotifiedAt: new Date() } });
      sent += 1;
    }
  }

  // 5. Completed notification to the clinic.
  const stuckCompleted = await db.quote.findMany({
    where: { completedNotifiedAt: null, completedAt: { lt: cutoff } },
    select: {
      id: true,
      requestDentist: { select: { dentist: { select: { email: true, locale: true, clinicName: true } } } },
    },
  });
  for (const q of stuckCompleted) {
    const dentist = q.requestDentist.dentist;
    const ok = await sendTreatmentCompletedEmail({
      to: dentist.email,
      clinicName: dentist.clinicName,
      locale: asLocale(dentist.locale),
    });
    if (ok) {
      await db.quote.update({ where: { id: q.id }, data: { completedNotifiedAt: new Date() } });
      sent += 1;
    }
  }

  return NextResponse.json({
    checked:
      stuckNewQuote.length +
      stuckDecision.length +
      stuckStarted.length +
      stuckCompletionRequested.length +
      stuckCompleted.length,
    sent,
  });
}
