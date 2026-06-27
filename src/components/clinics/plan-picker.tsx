"use client";

import { useState } from "react";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const OPTIONS = [
  {
    value: "MONTHLY" as const,
    title: "מסלול חודשי",
    price: `${SUBSCRIPTION_PLANS.MONTHLY.priceILS} ₪`,
    per: "לחודש",
    note: "ללא התחייבות — ביטול בכל עת",
  },
  {
    value: "YEARLY" as const,
    title: "מסלול שנתי",
    price: `${SUBSCRIPTION_PLANS.YEARLY.priceILS} ₪`,
    per: "לשנה",
    note: "חיסכון משמעותי לעומת חודשי",
  },
];

export function PlanPicker({ defaultValue = "MONTHLY" }: { defaultValue?: "MONTHLY" | "YEARLY" }) {
  const [selected, setSelected] = useState<"MONTHLY" | "YEARLY">(defaultValue);
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
