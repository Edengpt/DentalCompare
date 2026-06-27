"use server";

import { db } from "@/lib/db";
import { createSubscriptionPaymentPage, isPayPlusConfigured } from "@/lib/payplus";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";

export async function startPayment(
  setupToken: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isPayPlusConfigured()) {
    return { ok: false, error: "התשלומים אינם מוגדרים עדיין. פנו לתמיכה." };
  }

  const sub = await db.clinicSubscription.findUnique({
    where: { setupToken },
    select: {
      id: true,
      plan: true,
      priceILS: true,
      status: true,
      dentist: { select: { clinicName: true, email: true } },
    },
  });
  if (!sub) return { ok: false, error: "קישור לא תקין" };
  if (sub.status === "ACTIVE") return { ok: false, error: "המנוי כבר פעיל" };

  try {
    const { url } = await createSubscriptionPaymentPage({
      subscriptionId: sub.id,
      setupToken,
      amountILS: sub.priceILS,
      clinicName: sub.dentist.clinicName,
      email: sub.dentist.email,
      planLabelHe: SUBSCRIPTION_PLANS[sub.plan as "MONTHLY" | "YEARLY"].labelHe,
    });
    return { ok: true, url };
  } catch (err) {
    console.error("startPayment failed:", err);
    return { ok: false, error: "יצירת דף התשלום נכשלה — נסו שוב" };
  }
}
