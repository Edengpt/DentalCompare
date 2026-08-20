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
      priceMinor: true,
      currency: true,
      status: true,
      dentist: { select: { clinicName: true, email: true } },
    },
  });
  if (!sub) return { ok: false, error: "קישור לא תקין" };
  if (sub.status === "ACTIVE") return { ok: false, error: "המנוי כבר פעיל" };
  // Never open a payment page for an amount we can't read. Defaulting to 0
  // would present the clinic a free checkout and mark the setup complete.
  if (sub.priceMinor === null || sub.currency === null) {
    console.error("startPayment: subscription has no price", { subscriptionId: sub.id });
    return { ok: false, error: "תקלה בהגדרת המנוי. פנו לתמיכה." };
  }

  try {
    const { url, pageRequestUid } = await createSubscriptionPaymentPage({
      subscriptionId: sub.id,
      setupToken,
      amountMinor: sub.priceMinor,
      currency: sub.currency,
      clinicName: sub.dentist.clinicName,
      email: sub.dentist.email,
      planLabelHe: SUBSCRIPTION_PLANS[sub.plan as "MONTHLY" | "YEARLY"].labelHe,
    });
    // Persist the page_request_uid so the return page can actively verify the
    // charge with PayPlus (getPageRequestStatus) instead of trusting the URL.
    await db.clinicSubscription.update({
      where: { id: sub.id },
      data: { pageRequestUid },
    });
    return { ok: true, url };
  } catch (err) {
    console.error("startPayment failed:", err);
    return { ok: false, error: "יצירת דף התשלום נכשלה — נסו שוב" };
  }
}
