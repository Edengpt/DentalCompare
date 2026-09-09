"use server";

import { revalidatePath } from "next/cache";
import { getDictionary, type Dictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";
import { audit } from "@/lib/audit";
import { parsePricingInput, type PricingField } from "@/lib/subscription-pricing";
import type { SubscriptionProvider, SubscriptionTier } from "@/generated/prisma/enums";

/**
 * Admin management of the SubscriptionPricing table.
 *
 * Task 1 (2026-09-03) seeded one row per payment provider so pricing is data
 * rather than a constant baked into the checkout code. The tiered-pricing plan
 * (2026-09-08) widened that to one row per (provider, tier) pair — this is
 * still the write side of the same promise: validate, write, audit-log.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const TIERS = ["FREE", "BASIC", "PRO", "FEATURED"] as const;

function fieldLabel(t: Dictionary, field: PricingField): string {
  const labels: Record<PricingField, string> = {
    monthlyPriceMajor: t.admin.fieldMonthlyPrice,
    yearlyPriceMajor: t.admin.fieldYearlyPrice,
    trialDays: t.admin.fieldTrialDays,
    monthlyRequestCap: t.admin.fieldMonthlyRequestCap,
    trialRequestCap: t.admin.fieldTrialRequestCap,
  };
  return labels[field];
}

export async function updatePricing(formData: FormData): Promise<ActionResult> {
  const t = await getDictionary(await getRequestLocale());
  const admin = await requireAdmin();

  const providerRaw = String(formData.get("provider") ?? "");
  if (providerRaw !== "PAYPLUS" && providerRaw !== "STRIPE") {
    return { ok: false, error: t.errors.pricingNotFound };
  }
  const provider = providerRaw as SubscriptionProvider;

  const tierRaw = String(formData.get("tier") ?? "");
  if (!(TIERS as readonly string[]).includes(tierRaw)) {
    return { ok: false, error: t.errors.pricingNotFound };
  }
  const tier = tierRaw as SubscriptionTier;

  // The currency is immutable and never taken from the form — it is read from
  // the existing row so validation always converts major-to-minor units in the
  // currency this provider is actually priced in.
  const existing = await db.subscriptionPricing.findUnique({
    where: { provider_tier: { provider, tier } },
  });
  if (!existing) return { ok: false, error: t.errors.pricingNotFound };

  const parsed = parsePricingInput(
    {
      monthlyPriceMajor: String(formData.get("monthlyPriceMajor") ?? ""),
      yearlyPriceMajor: String(formData.get("yearlyPriceMajor") ?? ""),
      trialDays: String(formData.get("trialDays") ?? ""),
      monthlyRequestCap: String(formData.get("monthlyRequestCap") ?? ""),
      trialRequestCap: String(formData.get("trialRequestCap") ?? ""),
    },
    existing.currency,
    tier,
  );
  if (!parsed.ok) {
    return {
      ok: false,
      error: format(t.errors.pricingInvalidField, { field: fieldLabel(t, parsed.field) }),
    };
  }

  await db.subscriptionPricing.update({
    where: { provider_tier: { provider, tier } },
    data: { ...parsed.value, updatedBy: admin.email },
  });

  await audit({
    actor: admin.email,
    action: "pricing.update",
    entity: "SubscriptionPricing",
    entityId: `${provider}:${tier}`,
    metadata: {
      old: {
        monthlyPriceMinor: existing.monthlyPriceMinor,
        yearlyPriceMinor: existing.yearlyPriceMinor,
        trialDays: existing.trialDays,
        monthlyRequestCap: existing.monthlyRequestCap,
        trialRequestCap: existing.trialRequestCap,
      },
      new: parsed.value,
    },
  });

  revalidatePath("/admin/subscriptions");
  return { ok: true };
}
