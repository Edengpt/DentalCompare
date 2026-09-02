"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useT, useLocale } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { toMajor } from "@/lib/money";
import { updatePricing } from "@/server/pricing-actions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const inputClass =
  "border-border/60 bg-background focus:border-teal-deep focus:ring-teal-deep/20 w-24 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2";

type PricingRow = {
  provider: "PAYPLUS" | "STRIPE";
  currency: string;
  monthlyPriceMinor: number;
  yearlyPriceMinor: number;
  trialDays: number;
  updatedAt: Date;
  updatedBy: string | null;
};

export function PricingSettingsForm({ rows }: { rows: PricingRow[] }) {
  const t = useT();
  const locale = useLocale();

  return (
    <section className="border-border/60 bg-card rounded-2xl border p-5">
      <h2 className="text-foreground font-semibold">{t.admin.pricingHeading}</h2>
      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <PricingRowForm key={row.provider} row={row} />
        ))}
      </div>
    </section>
  );

  function PricingRowForm({ row }: { row: PricingRow }) {
    const [isPending, startTransition] = useTransition();
    const providerLabel =
      row.provider === "PAYPLUS" ? t.admin.pricingProviderPayPlus : t.admin.pricingProviderStripe;

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      startTransition(async () => {
        const result = await updatePricing(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(t.admin.pricingUpdated);
      });
    };

    return (
      <form
        onSubmit={handleSubmit}
        className="border-border/60 flex flex-wrap items-end gap-4 border-t pt-4 first:border-t-0 first:pt-0"
      >
        <input type="hidden" name="provider" value={row.provider} />
        <div className="min-w-[7rem]">
          <p className="text-foreground text-sm font-semibold">{providerLabel}</p>
          <p className="text-muted-foreground text-xs">{row.currency}</p>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t.admin.fieldMonthlyPrice}</span>
          <input
            name="monthlyPriceMajor"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={toMajor(row.monthlyPriceMinor, row.currency)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t.admin.fieldYearlyPrice}</span>
          <input
            name="yearlyPriceMajor"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={toMajor(row.yearlyPriceMinor, row.currency)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t.admin.fieldTrialDays}</span>
          <input
            name="trialDays"
            type="number"
            step="1"
            min="1"
            max="365"
            required
            defaultValue={row.trialDays}
            className={inputClass}
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className={cn(
            buttonVariants(),
            "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold disabled:opacity-60",
          )}
        >
          {isPending ? t.selection.saving : t.admin.pricingSave}
        </button>

        {row.updatedBy && (
          <p className="text-muted-foreground w-full text-xs">
            {format(t.admin.pricingLastUpdated, {
              email: row.updatedBy,
              date: new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
                row.updatedAt,
              ),
            })}
          </p>
        )}
      </form>
    );
  }
}
