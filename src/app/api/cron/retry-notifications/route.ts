import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { asLocale } from "@/i18n/config";
import { sendNewQuoteEmail } from "@/server/quote-notifications";
import { sendDueQuoteReminders } from "@/server/quote-reminders";
import { sendDueClinicReminders } from "@/server/clinic-reminders";
import {
  sendQuoteApprovedEmail,
  sendQuoteRejectedEmail,
  sendTreatmentStartedEmail,
  sendCompletionRequestedEmail,
  sendTreatmentCompletedEmail,
  sendTreatmentStartedByPatientEmail,
  sendCompletionDeclinedEmail,
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
 *
 * This route runs once a day (`vercel.json`'s `"0 8 * * *"`), so a single
 * block's thrown error (e.g. a row deleted between its `findMany` and its
 * `update`) must not abort the other four blocks — that would cost every
 * later block's notifications a full day of silence. Each block therefore
 * runs in its own try/catch, logs and moves on.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - ONE_HOUR_MS);
  let sent = 0;
  let checked = 0;

  // 1. New-quote notification to the patient (existing behavior, unchanged).
  try {
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
    checked += stuckNewQuote.length;
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
  } catch (err) {
    console.error("retry-notifications: new-quote block failed:", err);
  }

  // 2. Decision notification (approved or rejected) to the clinic.
  try {
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
    checked += stuckDecision.length;
    for (const q of stuckDecision) {
      const dentist = q.requestDentist.dentist;
      const send = q.status === "APPROVED" ? sendQuoteApprovedEmail : sendQuoteRejectedEmail;
      const ok = await send({ to: dentist.email, clinicName: dentist.clinicName, locale: asLocale(dentist.locale) });
      if (ok) {
        await db.quote.update({ where: { id: q.id }, data: { decisionNotifiedAt: new Date() } });
        sent += 1;
      }
    }
  } catch (err) {
    console.error("retry-notifications: decision block failed:", err);
  }

  // 3. Treatment-started notification — to whichever side did NOT mark it.
  // A null actor is a row from before patients could mark it: the clinic did.
  try {
    const stuckStarted = await db.quote.findMany({
      where: { treatmentStartedNotifiedAt: null, treatmentStartedAt: { lt: cutoff } },
      select: {
        id: true,
        treatmentStartedBy: true,
        requestDentist: {
          select: {
            requestId: true,
            dentist: { select: { clinicName: true, email: true, locale: true } },
            request: { select: { user: { select: { fullName: true, email: true, locale: true } } } },
          },
        },
      },
    });
    checked += stuckStarted.length;
    for (const q of stuckStarted) {
      const dentist = q.requestDentist.dentist;
      let ok: boolean;
      if (q.treatmentStartedBy === "PATIENT") {
        ok = await sendTreatmentStartedByPatientEmail({
          to: dentist.email,
          clinicName: dentist.clinicName,
          locale: asLocale(dentist.locale),
        });
      } else {
        const user = q.requestDentist.request.user;
        if (!user) continue;
        ok = await sendTreatmentStartedEmail({
          to: user.email,
          patientName: user.fullName,
          clinicName: dentist.clinicName,
          requestId: q.requestDentist.requestId,
          locale: asLocale(user.locale),
        });
      }
      if (ok) {
        await db.quote.update({ where: { id: q.id }, data: { treatmentStartedNotifiedAt: new Date() } });
        sent += 1;
      }
    }
  } catch (err) {
    console.error("retry-notifications: treatment-started block failed:", err);
  }

  // 4. Completion-requested notification to the patient.
  try {
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
    checked += stuckCompletionRequested.length;
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
  } catch (err) {
    console.error("retry-notifications: completion-requested block failed:", err);
  }

  // 5. Completed notification to the clinic.
  try {
    const stuckCompleted = await db.quote.findMany({
      where: { completedNotifiedAt: null, completedAt: { lt: cutoff } },
      select: {
        id: true,
        requestDentist: { select: { dentist: { select: { email: true, locale: true, clinicName: true } } } },
      },
    });
    checked += stuckCompleted.length;
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
  } catch (err) {
    console.error("retry-notifications: completed block failed:", err);
  }

  // 6. "Still ongoing" notification to the clinic.
  try {
    const stuckDeclined = await db.quote.findMany({
      where: { completionDeclinedNotifiedAt: null, completionDeclinedAt: { lt: cutoff } },
      select: {
        id: true,
        requestDentist: { select: { dentist: { select: { email: true, locale: true, clinicName: true } } } },
      },
    });
    checked += stuckDeclined.length;
    for (const q of stuckDeclined) {
      const dentist = q.requestDentist.dentist;
      const ok = await sendCompletionDeclinedEmail({
        to: dentist.email,
        clinicName: dentist.clinicName,
        locale: asLocale(dentist.locale),
      });
      if (ok) {
        await db.quote.update({ where: { id: q.id }, data: { completionDeclinedNotifiedAt: new Date() } });
        sent += 1;
      }
    }
  } catch (err) {
    console.error("retry-notifications: completion-declined block failed:", err);
  }

  // Not a retry: the one reminder about quotes the patient hasn't opened.
  // Lives in this daily run rather than its own cron so it goes out at the
  // same civil hour as every other patient email.
  let reminders = { checked: 0, sent: 0 };
  try {
    reminders = await sendDueQuoteReminders();
  } catch (err) {
    console.error("retry-notifications: quote-reminder block failed:", err);
  }

  // And the one nudge to a clinic that hasn't quoted a day after the request.
  let clinicReminders = { checked: 0, sent: 0 };
  try {
    clinicReminders = await sendDueClinicReminders();
  } catch (err) {
    console.error("retry-notifications: clinic-reminder block failed:", err);
  }

  return NextResponse.json({ checked, sent, reminders, clinicReminders });
}
