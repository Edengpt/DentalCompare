"use client";

import { X } from "lucide-react";
import { useLocale, useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { quoteItemName } from "@/lib/labels";
import { formatMoney, toMinor } from "@/lib/money";
import { QUOTE_LIMITS } from "@/lib/quote-catalog";
import type { QuoteFormLine } from "@/lib/quote-form-state";

const cellInput =
  "border-border/60 focus:border-teal-deep w-full rounded-md border px-2.5 py-2 text-sm outline-none";

/** The treatments added so far, each with its quantity, unit price and line total. */
export function TreatmentLines({
  lines,
  currency,
  onChange,
  onRemove,
}: {
  lines: QuoteFormLine[];
  currency: string;
  onChange: (key: string, patch: Partial<Pick<QuoteFormLine, "quantity" | "unitPrice">>) => void;
  onRemove: (key: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const q = t.quoteForm;

  if (lines.length === 0) {
    return <p className="text-muted-foreground text-sm italic">{q.noLinesYet}</p>;
  }

  return (
    <ul className="divide-border/60 border-border/60 divide-y rounded-lg border">
      {lines.map((line) => {
        const qty = Number(line.quantity);
        const unit = line.unitPrice.trim() === "" ? NaN : Number(line.unitPrice);
        const total =
          Number.isInteger(qty) && qty > 0 && Number.isFinite(unit) && unit >= 0
            ? formatMoney(toMinor(unit, currency) * qty, currency, locale)
            : "—";
        return (
          <li key={line.key} className="space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-foreground text-sm font-medium" dir="auto">
                {quoteItemName(t.labels, line)}
              </p>
              <button
                type="button"
                onClick={() => onRemove(line.key)}
                aria-label={q.removeLine}
                className="text-muted-foreground hover:text-alert -m-1 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-[5rem_1fr_auto] items-end gap-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">{q.quantity}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={QUOTE_LIMITS.maxQuantity}
                  required
                  value={line.quantity}
                  onChange={(e) => onChange(line.key, { quantity: e.target.value })}
                  className={cellInput}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">{format(q.unitPrice, { currency })}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  required
                  value={line.unitPrice}
                  onChange={(e) => onChange(line.key, { unitPrice: e.target.value })}
                  className={cellInput}
                />
              </label>
              <div className="pb-2 text-end text-sm">
                <span className="text-muted-foreground block text-xs">{q.lineTotal}</span>
                <span className="text-foreground font-semibold tabular-nums">{total}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
