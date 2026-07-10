import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isDueForRenewal, isWithinGrace, nextPeriodEnd } from "@/lib/subscription";
import { chargeByToken, isPayPlusConfigured } from "@/lib/payplus";
import { recordRenewalCharge, markPastDue, cancelSubscription } from "@/server/subscriptions";
import { sendPaymentFailedEmail } from "@/server/subscription-notifications";
import { audit } from "@/lib/audit";
import { logEvent } from "@/lib/log";
import { type SubscriptionPlanType } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Defensive gate: no-op if PayPlus credentials aren't configured.
  if (!isPayPlusConfigured()) {
    return NextResponse.json({ checked: 0, renewed: 0, failed: 0, canceled: 0 });
  }

  const now = new Date();
  // Both ACTIVE (due for renewal) and PAST_DUE (being retried within grace).
  const candidates = await db.clinicSubscription.findMany({
    where: {
      status: { in: ["ACTIVE", "PAST_DUE"] },
      recurringToken: { not: null },
      currentPeriodEnd: { not: null },
    },
    select: {
      id: true,
      plan: true,
      priceILS: true,
      status: true,
      recurringToken: true,
      payplusCustomerUid: true,
      currentPeriodEnd: true,
      dentist: { select: { clinicName: true, email: true } },
    },
  });

  let renewed = 0;
  let failed = 0;
  let canceled = 0;

  for (const sub of candidates) {
    if (!sub.currentPeriodEnd || !sub.recurringToken) continue;

    // A PAST_DUE clinic past its grace window has lapsed → cancel and drop it.
    if (sub.status === "PAST_DUE" && !isWithinGrace(sub.currentPeriodEnd, now)) {
      await cancelSubscription(sub.id);
      await audit({
        actor: "system",
        action: "subscription.canceled",
        entity: "ClinicSubscription",
        entityId: sub.id,
        metadata: { reason: "grace_expired" },
      });
      canceled += 1;
      continue;
    }

    // ACTIVE subs are charged only inside the lead window; PAST_DUE subs are
    // already past their end, so they get retried on every run within grace.
    if (sub.status === "ACTIVE" && !isDueForRenewal(sub.currentPeriodEnd, now)) continue;

    try {
      const result = await chargeByToken({
        recurringToken: sub.recurringToken,
        payplusCustomerUid: sub.payplusCustomerUid,
        amountILS: sub.priceILS,
        description: `חידוש מנוי DentalCompare — ${sub.dentist.clinicName}`,
      });

      if (result.ok) {
        const periodStart = sub.currentPeriodEnd;
        const periodEnd = nextPeriodEnd(periodStart, sub.plan as SubscriptionPlanType);
        await recordRenewalCharge({
          subscriptionId: sub.id,
          transactionUid: result.transactionUid,
          amountILS: sub.priceILS,
          periodStart,
          periodEnd,
        });
        await audit({
          actor: "system",
          action: "subscription.renewed",
          entity: "ClinicSubscription",
          entityId: sub.id,
          metadata: { transactionUid: result.transactionUid, amountILS: sub.priceILS },
        });
        renewed += 1;
      } else {
        logEvent("error", "subscription.charge_failed", {
          subscriptionId: sub.id,
          error: result.error,
        });
        // Move to PAST_DUE and notify the clinic exactly once (not every retry).
        const firstFailure = await markPastDue(sub.id);
        if (firstFailure) {
          await sendPaymentFailedEmail({
            email: sub.dentist.email,
            clinicName: sub.dentist.clinicName,
          });
        }
        failed += 1;
      }
    } catch (err) {
      logEvent("error", "subscription.renew_error", {
        subscriptionId: sub.id,
        error: err instanceof Error ? err.message : String(err),
      });
      failed += 1;
    }
  }

  return NextResponse.json({ checked: candidates.length, renewed, failed, canceled });
}
