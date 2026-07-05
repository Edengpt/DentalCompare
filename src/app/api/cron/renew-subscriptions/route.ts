import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isDueForRenewal, nextPeriodEnd } from "@/lib/subscription";
import { chargeByToken, isPayPlusConfigured } from "@/lib/payplus";
import { recordRenewalCharge, markPastDue } from "@/server/subscriptions";
import { sendPaymentFailedEmail } from "@/server/subscription-notifications";
import { SUBSCRIPTION_PLANS, type SubscriptionPlanType } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Defensive gate: no-op if PayPlus credentials aren't configured.
  if (!isPayPlusConfigured()) {
    return NextResponse.json({ checked: 0, renewed: 0, failed: 0 });
  }

  const now = new Date();
  const candidates = await db.clinicSubscription.findMany({
    where: { status: "ACTIVE", recurringToken: { not: null }, currentPeriodEnd: { not: null } },
    select: {
      id: true,
      plan: true,
      priceILS: true,
      recurringToken: true,
      payplusCustomerUid: true,
      currentPeriodEnd: true,
      dentist: { select: { clinicName: true, email: true } },
    },
  });

  let renewed = 0;
  let failed = 0;

  for (const sub of candidates) {
    if (!sub.currentPeriodEnd || !sub.recurringToken) continue;
    if (!isDueForRenewal(sub.currentPeriodEnd, now)) continue;

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
        renewed += 1;
      } else {
        await markPastDue(sub.id);
        await sendPaymentFailedEmail({ email: sub.dentist.email, clinicName: sub.dentist.clinicName });
        failed += 1;
      }
    } catch (err) {
      console.error(`[renew-subscriptions] Error processing sub ${sub.id}:`, err);
      failed += 1;
    }
  }

  // SUBSCRIPTION_PLANS referenced to keep label parity available for future use.
  void SUBSCRIPTION_PLANS;
  return NextResponse.json({ checked: candidates.length, renewed, failed });
}
