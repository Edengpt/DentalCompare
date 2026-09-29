"use client";

import { toMajor } from "@/lib/money";
import { format } from "@/i18n/format";
import { useT, useLocale } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type PlanChoice = "FREE" | "MONTHLY" | "YEARLY";

/** One provider's offer, as the join page reads it from SubscriptionPricing. */
export type PlanOffer = {
  currency: string;
  freeCap: number | null;
  basicCap: number | null;
  monthlyMinor: number;
  yearlyMinor: number;
  trialDays: number;
  /** Founding prices while places remain, else null. */
  founding: { monthlyMinor: number; yearlyMinor: number } | null;
};

/**
 * Three cards, one choice: free, or the paid plan billed monthly or yearly.
 * While founding places remain, the paid cards show the list price struck
 * through beside the founding price the clinic will actually pay.
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
    cap === null ? null : format(t.clinics.planCapLine, { cap });

  const OPTIONS = [
    {
      value: "FREE" as const,
      title: t.clinics.planFreeTitle,
      price: money(0),
      was: null,
      per: null,
      cap: capLine(offer.freeCap),
      note: t.clinics.planFreeNote,
      founding: false,
    },
    {
      value: "MONTHLY" as const,
      title: t.clinics.planMonthlyTitle,
      price: money(offer.founding?.monthlyMinor ?? offer.monthlyMinor),
      was: offer.founding ? money(offer.monthlyMinor) : null,
      per: t.clinics.planMonthlyPer,
      cap: capLine(offer.basicCap),
      note: t.clinics.planMonthlyNote,
      founding: offer.founding !== null,
    },
    {
      value: "YEARLY" as const,
      title: t.clinics.planYearlyTitle,
      price: money(offer.founding?.yearlyMinor ?? offer.yearlyMinor),
      was: offer.founding ? money(offer.yearlyMinor) : null,
      per: t.clinics.planYearlyPer,
      cap: capLine(offer.basicCap),
      note: t.clinics.planYearlyNote,
      founding: offer.founding !== null,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map((o) => (
        <label
          key={o.value}
          className={cn(
            "flex cursor-pointer flex-col rounded-lg border p-5 transition-colors",
            value === o.value
              ? "border-teal-deep bg-teal-deep/5 ring-teal-deep/20 ring-2"
              : "border-border/60 hover:border-teal-deep/40",
          )}
        >
          <input
            type="radio"
            name="plan"
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
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
          <p className="text-muted-foreground mt-1 text-xs">{o.note}</p>
        </label>
      ))}
    </div>
  );
}
