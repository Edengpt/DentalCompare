"use server";

import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { createSubscriptionPaymentPage, isPayPlusConfigured } from "@/lib/payplus";
import { asLocale } from "@/i18n/config";

export async function startPayment(
  setupToken: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  if (!isPayPlusConfigured()) {
    return { ok: false, error: e.paymentsNotConfigured };
  }

  const sub = await db.clinicSubscription.findUnique({
    where: { setupToken },
    select: {
      id: true,
      plan: true,
      priceMinor: true,
      currency: true,
      status: true,
      dentist: { select: { clinicName: true, email: true, locale: true } },
    },
  });
  if (!sub) return { ok: false, error: e.invalidLink };
  if (sub.status === "ACTIVE") return { ok: false, error: e.subscriptionAlreadyActive };
  // Never open a payment page for an amount we can't read. Defaulting to 0
  // would present the clinic a free checkout and mark the setup complete.
  if (sub.priceMinor === null || sub.currency === null) {
    console.error("startPayment: subscription has no price", { subscriptionId: sub.id });
    return { ok: false, error: e.subscriptionMisconfigured };
  }

  const t = await getDictionary(asLocale(sub.dentist.locale));

  try {
    const { url, pageRequestUid } = await createSubscriptionPaymentPage({
      subscriptionId: sub.id,
      setupToken,
      amountMinor: sub.priceMinor,
      currency: sub.currency,
      clinicName: sub.dentist.clinicName,
      email: sub.dentist.email,
      itemName: format(t.clinics.itemSubscription, {
        plan: sub.plan === "MONTHLY" ? t.emails.planMonthly : t.emails.planYearly,
      }),
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
    return { ok: false, error: e.paymentPageFailed };
  }
}
