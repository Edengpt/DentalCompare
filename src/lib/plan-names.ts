import type { Dictionary } from "@/i18n/get-dictionary";

/** A plan's name as a clinic reads it: "Basic", "Pro". */
export function tierName(t: Dictionary, tier: string): string {
  if (tier === "PRO") return t.clinics.planProTitle;
  if (tier === "FEATURED") return t.admin.tierFeatured;
  if (tier === "FREE") return t.clinics.planFreeTitle;
  return t.clinics.planBasicTitle;
}

/** "monthly" / "annual", lower case, for use inside a sentence. */
export function periodName(t: Dictionary, plan: string): string {
  return plan === "YEARLY" ? t.emails.planYearly : t.emails.planMonthly;
}
