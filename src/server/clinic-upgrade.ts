"use server";

import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { db } from "@/lib/db";
import { getSubscriptionPricing } from "@/lib/subscription-pricing";
import { foundingPriceMinor } from "@/lib/founding";
import { trialEndFrom } from "@/lib/subscription";
import { audit } from "@/lib/audit";
import { getClinicForCurrentUser } from "@/server/clinic-account";
import { foundingSlotsLeft } from "@/server/founding";

/**
 * How long a clinic that upgraded keeps the paid tier's allowance before it
 * has entered a card. Not a second free trial — it already had the free tier —
 * just time to finish checkout without losing the requests it upgraded for.
 */
const UPGRADE_GRACE_DAYS = 7;

/**
 * Moves a free clinic onto the paid tier and hands back its payment link.
 *
 * The subscription row is rewritten in place (tier, price, cap, plan) and
 * re-enters TRIALING with a short grace period, so everything downstream —
 * the payment page, the trial cron, the immediate conversion on the request
 * counter — treats it exactly like a clinic that registered on the paid tier.
 * A founding place is offered here too while any remain.
 */
export async function upgradeToPaid(
  plan: "MONTHLY" | "YEARLY",
): Promise<{ ok: true; setupToken: string } | { ok: false; error: string }> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const clinic = await getClinicForCurrentUser();
  if (!clinic) return { ok: false, error: e.clinicNotFound };
  if (plan !== "MONTHLY" && plan !== "YEARLY")
    return { ok: false, error: e.subscriptionMisconfigured };

  const sub = await db.clinicSubscription.findUnique({
    where: { dentistId: clinic.id },
    select: {
      id: true,
      tier: true,
      status: true,
      provider: true,
      setupToken: true,
      verifiedRequestCount: true,
    },
  });
  if (!sub) return { ok: false, error: e.clinicNoSubscription };
  // Only an approved free clinic upgrades this way. A pending one is still in
  // review; anything else is already on a paid tier.
  if (sub.tier !== "FREE" || sub.status !== "ACTIVE") {
    return { ok: false, error: e.subscriptionAlreadyActive };
  }

  const pricing = await getSubscriptionPricing(sub.provider, "BASIC");
  const regularMinor = plan === "MONTHLY" ? pricing.monthlyPriceMinor : pricing.yearlyPriceMinor;
  const now = new Date();

  const isFounding = await db.$transaction(async (tx) => {
    const founding = (await foundingSlotsLeft(tx)) > 0;
    await tx.clinicSubscription.update({
      where: { id: sub.id },
      data: {
        tier: "BASIC",
        plan,
        status: "TRIALING",
        priceMinor: founding ? foundingPriceMinor(regularMinor, pricing.currency) : regularMinor,
        regularPriceMinor: founding ? regularMinor : null,
        isFounding: founding,
        currency: pricing.currency,
        monthlyRequestCap: pricing.monthlyRequestCap,
        trialDays: UPGRADE_GRACE_DAYS,
        trialEndsAt: trialEndFrom(now, UPGRADE_GRACE_DAYS),
        // Converts on the next few delivered requests at the latest, the same
        // outcome-based trigger a new paid clinic gets.
        trialRequestCap: sub.verifiedRequestCount + pricing.trialRequestCap,
        trialWarningSentDays: null,
        trialEndedUnbilledAt: null,
      },
    });
    return founding;
  });

  await audit({
    actor: clinic.email,
    action: "subscription.upgraded",
    entity: "ClinicSubscription",
    entityId: sub.id,
    metadata: { plan, isFounding },
  });

  return { ok: true, setupToken: sub.setupToken };
}
