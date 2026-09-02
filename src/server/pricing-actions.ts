"use server";

import { revalidatePath } from "next/cache";
import { getDictionary, type Dictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";
import { audit } from "@/lib/audit";
import { parsePricingInput, type PricingField } from "@/lib/subscription-pricing";
import type { SubscriptionProvider } from "@/generated/prisma/enums";

/**
 * Admin management of the SubscriptionPricing table.
 *
 * Task 1 seeded one row per payment provider so pricing is data rather than a
 * constant baked into the checkout code. This is the write side of that
 * promise — the closest sibling is src/server/country-actions.ts, and it
 * shares the same shape: validate, write, audit-log.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

function fieldLabel(t: Dictionary, field: PricingField): string {
  const labels: Record<PricingField, string> = {
    monthlyPriceMajor: t.admin.fieldMonthlyPrice,
    yearlyPriceMajor: t.admin.fieldYearlyPrice,
    trialDays: t.admin.fieldTrialDays,
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

  // The currency is immutable and never taken from the form — it is read from
  // the existing row so validation always converts major-to-minor units in the
  // currency this provider is actually priced in.
  const existing = await db.subscriptionPricing.findUnique({ where: { provider } });
  if (!existing) return { ok: false, error: t.errors.pricingNotFound };

  const parsed = parsePricingInput(
    {
      monthlyPriceMajor: String(formData.get("monthlyPriceMajor") ?? ""),
      yearlyPriceMajor: String(formData.get("yearlyPriceMajor") ?? ""),
      trialDays: String(formData.get("trialDays") ?? ""),
    },
    existing.currency,
  );
  if (!parsed.ok) {
    return {
      ok: false,
      error: format(t.errors.pricingInvalidField, { field: fieldLabel(t, parsed.field) }),
    };
  }

  await db.subscriptionPricing.update({
    where: { provider },
    data: { ...parsed.value, updatedBy: admin.email },
  });

  await audit({
    actor: admin.email,
    action: "pricing.update",
    entity: "SubscriptionPricing",
    entityId: provider,
    metadata: {
      old: {
        monthlyPriceMinor: existing.monthlyPriceMinor,
        yearlyPriceMinor: existing.yearlyPriceMinor,
        trialDays: existing.trialDays,
      },
      new: parsed.value,
    },
  });

  revalidatePath("/admin/subscriptions");
  return { ok: true };
}
