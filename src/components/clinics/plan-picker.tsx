"use client";

import { formatMoney } from "@/lib/money";
import { useT, useLocale } from "@/i18n/provider";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function PlanPicker({
  defaultValue = "MONTHLY",
  monthly,
  yearly,
}: {
  defaultValue?: "MONTHLY" | "YEARLY";
  monthly: { priceMinor: number; currency: string };
  yearly: { priceMinor: number; currency: string };
}) {
  const t = useT();
  const locale = useLocale();
  const [selected, setSelected] = useState<"MONTHLY" | "YEARLY">(defaultValue);

  // Built inside the component because the labels come from context, and the
  // price is formatted in the reader's locale rather than a fixed "he-IL".
  const OPTIONS = [
    {
      value: "MONTHLY" as const,
      title: t.clinics.planMonthlyTitle,
      price: formatMoney(monthly.priceMinor, monthly.currency, locale),
      per: t.clinics.planMonthlyPer,
      note: t.clinics.planMonthlyNote,
    },
    {
      value: "YEARLY" as const,
      title: t.clinics.planYearlyTitle,
      price: formatMoney(yearly.priceMinor, yearly.currency, locale),
      per: t.clinics.planYearlyPer,
      note: t.clinics.planYearlyNote,
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((o) => (
        <label
          key={o.value}
          className={cn(
            "cursor-pointer rounded-2xl border p-5 transition-colors",
            selected === o.value
              ? "border-teal-deep bg-teal-deep/5 ring-teal-deep/20 ring-2"
              : "border-border/60 hover:border-teal-deep/40",
          )}
        >
          <input
            type="radio"
            name="plan"
            value={o.value}
            checked={selected === o.value}
            onChange={() => setSelected(o.value)}
            className="sr-only"
          />
          <p className="text-foreground font-semibold">{o.title}</p>
          <p className="text-foreground mt-2 text-2xl font-bold">
            {o.price} <span className="text-muted-foreground text-sm font-normal">{o.per}</span>
          </p>
          <p className="text-muted-foreground mt-1 text-xs">{o.note}</p>
        </label>
      ))}
    </div>
  );
}
