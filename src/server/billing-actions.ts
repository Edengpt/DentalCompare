"use server";

import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { createSubscriptionPaymentPage, isPayPlusConfigured } from "@/lib/payplus";
import { createSubscriptionCheckoutSession, isStripeConfigured } from "@/lib/stripe";
import { hasCompletedPaymentSetup } from "@/lib/subscription";
import { asLocale } from "@/i18n/config";

export async function startPayment(
  setupToken: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const t = await getDictionary(await getRequestLocale());
  const e = t.errors;

  const sub = await db.clinicSubscription.findUnique({
    where: { setupToken },
    select: {
      id: true,
      plan: true,
      priceMinor: true,
      currency: true,
      status: true,
      provider: true,
      trialDays: true,
      recurringToken: true,
      stripeSubscriptionId: true,
      dentist: { select: { clinicName: true, email: true, locale: true } },
    },
  });
  if (!sub) return { ok: false, error: e.invalidLink };
  if (hasCompletedPaymentSetup(sub)) return { ok: false, error: e.subscriptionAlreadyActive };
  // Never open a payment page for an amount we can't read. Defaulting to 0
  // would present the clinic a free checkout and mark the setup complete.
  if (sub.priceMinor === null || sub.currency === null) {
    console.error("startPayment: subscription has no price", { subscriptionId: sub.id });
    return { ok: false, error: e.subscriptionMisconfigured };
  }

  // The payment line item is built from the CLINIC's own saved locale, not
  // the ambient request locale — a Hebrew clinic must always see a Hebrew
  // line item on its checkout, even if this action is ever reached from a
  // different locale segment than the one the clinic registered under.
  const clinicT = await getDictionary(asLocale(sub.dentist.locale));
  const itemName = format(clinicT.clinics.itemSubscription, {
    plan: sub.plan === "MONTHLY" ? clinicT.emails.planMonthly : clinicT.emails.planYearly,
  });

  if (sub.provider === "STRIPE") {
    if (!isStripeConfigured()) {
      return { ok: false, error: e.paymentsNotConfigured };
    }
    try {
      const { url } = await createSubscriptionCheckoutSession({
        setupToken,
        amountMinor: sub.priceMinor,
        currency: sub.currency,
        trialDays: sub.trialDays,
        intervalMonths: sub.plan === "MONTHLY" ? 1 : 12,
        clinicName: sub.dentist.clinicName,
        email: sub.dentist.email,
        itemName,
      });
      return { ok: true, url };
    } catch (err) {
      console.error("startPayment (Stripe) failed:", err);
      return { ok: false, error: e.paymentPageFailed };
    }
  }

  // provider === "PAYPLUS" — existing behavior, unchanged.
  if (!isPayPlusConfigured()) {
    return { ok: false, error: e.paymentsNotConfigured };
  }
  try {
    const { url, pageRequestUid } = await createSubscriptionPaymentPage({
      subscriptionId: sub.id,
      setupToken,
      amountMinor: sub.priceMinor,
      currency: sub.currency,
      clinicName: sub.dentist.clinicName,
      email: sub.dentist.email,
      itemName,
    });
    // Persist the page_request_uid so the return page can actively verify the
    // charge with PayPlus (getPageRequestStatus) instead of trusting the URL.
    await db.clinicSubscription.update({ where: { id: sub.id }, data: { pageRequestUid } });
    return { ok: true, url };
  } catch (err) {
    console.error("startPayment failed:", err);
    return { ok: false, error: e.paymentPageFailed };
  }
}
