"use client";

import { useLocale, useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { formatMoney } from "@/lib/money";
import type { QuoteTotals, PricingError } from "@/lib/quote-pricing";
import { fieldClass } from "./chip";

/**
 * Subtotal, optional package discount, final price — computed live with the
 * same function the server prices with, so the number the clinic sees here is
 * the number the patient gets.
 */
export function PriceSummary({
  totals,
  currency,
  discount,
  onDiscountChange,
}: {
  totals: QuoteTotals | { ok: false; error: PricingError };
  currency: string;
  discount: string;
  onDiscountChange: (value: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const q = t.quoteForm;
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const discountError = !totals.ok && totals.error === "BAD_DISCOUNT";

  return (
    <div className="bg-teal-deep/5 border-teal-deep/20 space-y-3 rounded-lg border p-4">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{q.subtotal}</span>
        <span className="text-foreground font-medium tabular-nums">
          {totals.ok ? money(totals.subtotalMinor) : "—"}
        </span>
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">{format(q.discountLabel, { currency })}</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={discount}
          onChange={(e) => onDiscountChange(e.target.value)}
          aria-invalid={discountError}
          className={fieldClass}
        />
        {discountError && <span className="text-alert text-xs">{q.discountTooHigh}</span>}
      </label>
      <div className="border-teal-deep/20 flex items-baseline justify-between border-t pt-3">
        <span className="text-foreground text-sm font-semibold">{q.finalPrice}</span>
        <span className="text-teal-deep text-xl font-bold tabular-nums">
          {totals.ok ? money(totals.finalMinor) : "—"}
        </span>
      </div>
    </div>
  );
}
