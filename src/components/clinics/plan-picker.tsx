"use client";

import { toMajor } from "@/lib/money";
import { format } from "@/i18n/format";
import { useT, useLocale } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type PlanTier = "FREE" | "BASIC" | "PRO";
export type BillingPeriod = "MONTHLY" | "YEARLY";

/** The clinic's choice: which plan, and (for a paid one) how it is billed. */
export type PlanChoice = { tier: PlanTier; billing: BillingPeriod };

/** One paid plan's prices, as the join page reads them from SubscriptionPricing. */
export type TierOffer = {
  cap: number | null;
  monthlyMinor: number;
  yearlyMinor: number;
  /** Founding prices while places remain, else null. */
  founding: { monthlyMinor: number; yearlyMinor: number } | null;
};

/** One provider's offer: the free plan plus the two paid plans. */
export type PlanOffer = {
  currency: string;
  freeCap: number | null;
  trialDays: number;
  BASIC: TierOffer;
  PRO: TierOffer;
};

/**
 * The form field the server reads: FREE, or the billing period of a paid plan.
 * The plan itself travels in a separate `tier` field.
 */
export function planField(choice: PlanChoice): "FREE" | BillingPeriod {
  return choice.tier === "FREE" ? "FREE" : choice.billing;
}

/**
 * A monthly/yearly switch above three cards: Free, Basic and Pro. The paid
 * cards show the price for the chosen period, the free trial they start with,
 * and, while founding places remain, the list price struck through beside the
 * founding price the clinic will actually pay.
 */
export function PlanPicker({
  value,
  onChange,
  offer,
}: {
  value: PlanChoice;
  onChange: (value: PlanChoice) => void;
  offer: PlanOffer;
}) {
  const t = useT();
  const locale = useLocale();
  // Whole prices without ".00": a price card reads "₪199", not "₪199.00".
  const money = (minor: number) => {
    const major = toMajor(minor, offer.currency);
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: offer.currency,
      maximumFractionDigits: Number.isInteger(major) ? 0 : 2,
    }).format(major);
  };
  const capLine = (cap: number | null) =>
    cap === null ? t.clinics.planCapUnlimited : format(t.clinics.planCapLine, { cap });
  const yearly = value.billing === "YEARLY";

  const paid = (tier: "BASIC" | "PRO", title: string, note: string) => {
    const o = offer[tier];
    const list = yearly ? o.yearlyMinor : o.monthlyMinor;
    const founding = o.founding
      ? yearly
        ? o.founding.yearlyMinor
        : o.founding.monthlyMinor
      : null;
    return {
      value: tier,
      title,
      price: money(founding ?? list),
      was: founding !== null ? money(list) : null,
      per: yearly ? t.clinics.planYearlyPer : t.clinics.planMonthlyPer,
      cap: capLine(o.cap),
      trial: format(t.clinics.planTrialLine, { days: offer.trialDays }),
      note,
    };
  };

  const OPTIONS = [
    {
      value: "FREE" as const,
      title: t.clinics.planFreeTitle,
      price: money(0),
      was: null,
      per: null,
      cap: offer.freeCap === null ? null : capLine(offer.freeCap),
      trial: null,
      note: t.clinics.planFreeNote,
    },
    paid("BASIC", t.clinics.planBasicTitle, t.clinics.planBasicNote),
    paid("PRO", t.clinics.planProTitle, t.clinics.planProNote),
  ];

  const periods: Array<{ value: BillingPeriod; label: string }> = [
    { value: "MONTHLY", label: t.clinics.planBillMonthly },
    { value: "YEARLY", label: t.clinics.planBillYearly },
  ];

  return (
    <div>
      <div
        role="radiogroup"
        aria-label={t.clinics.planBillingLabel}
        className="border-border/60 bg-card inline-flex rounded-lg border p-1"
      >
        {periods.map((p) => (
          <label
            key={p.value}
            className={cn(
              "cursor-pointer rounded-md px-4 py-2 text-sm font-semibold transition-colors",
              value.billing === p.value
                ? "bg-teal-deep text-cream"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name="billing"
              value={p.value}
              checked={value.billing === p.value}
              onChange={() => onChange({ ...value, billing: p.value })}
              className="sr-only"
            />
            {p.label}
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer flex-col rounded-lg border p-5 transition-colors",
              value.tier === o.value
                ? "border-teal-deep bg-teal-deep/5 ring-teal-deep/20 ring-2"
                : "border-border/60 hover:border-teal-deep/40",
            )}
          >
            <input
              type="radio"
              name="tier"
              value={o.value}
              checked={value.tier === o.value}
              onChange={() => onChange({ ...value, tier: o.value })}
              className="sr-only"
            />
            <p className="text-foreground font-semibold">{o.title}</p>
            <p className="text-foreground mt-2 text-2xl font-bold">
              {o.price}{" "}
              {o.per && <span className="text-muted-foreground text-sm font-normal">{o.per}</span>}
            </p>
            {o.was && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <s className="text-muted-foreground">{o.was}</s>
                <span className="bg-highlight text-on-highlight rounded-sm px-1.5 py-0.5 font-semibold">
                  {t.clinics.planFoundingBadge}
                </span>
              </div>
            )}
            {o.cap && <p className="text-foreground mt-2 text-sm">{o.cap}</p>}
            {o.trial && <p className="text-teal-deep mt-1 text-sm font-semibold">{o.trial}</p>}
            <p className="text-muted-foreground mt-1 text-xs">{o.note}</p>
          </label>
        ))}
      </div>
      <input type="hidden" name="plan" value={planField(value)} />
    </div>
  );
}
