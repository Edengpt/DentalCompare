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
  "border-border/60 bg-background focus:border-teal-deep focus:ring-teal-deep/20 w-24 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 read-only:opacity-50";

type SubscriptionTier = "FREE" | "BASIC" | "PRO" | "FEATURED";

type PricingRow = {
  provider: "PAYPLUS" | "STRIPE";
  tier: SubscriptionTier;
  currency: string;
  monthlyPriceMinor: number;
  yearlyPriceMinor: number;
  monthlyRequestCap: number | null;
  trialDays: number;
  trialRequestCap: number;
  updatedAt: Date;
  updatedBy: string | null;
};

const TIER_ORDER: SubscriptionTier[] = ["FREE", "BASIC", "PRO", "FEATURED"];
const PROVIDER_ORDER: Array<"PAYPLUS" | "STRIPE"> = ["PAYPLUS", "STRIPE"];

export function PricingSettingsForm({ rows }: { rows: PricingRow[] }) {
  const t = useT();

  return (
    <section className="border-border/60 bg-card rounded-lg border p-5">
      <h2 className="text-foreground font-semibold">{t.admin.pricingHeading}</h2>
      <div className="mt-4 space-y-8">
        {PROVIDER_ORDER.map((provider) => {
          const providerRows = TIER_ORDER.map((tier) =>
            rows.find((r) => r.provider === provider && r.tier === tier),
          ).filter((r): r is PricingRow => r !== undefined);
          if (providerRows.length === 0) return null;

          const providerLabel =
            provider === "PAYPLUS" ? t.admin.pricingProviderPayPlus : t.admin.pricingProviderStripe;

          return (
            <div key={provider}>
              <h3 className="text-foreground text-sm font-semibold">{providerLabel}</h3>
              <div className="mt-3 space-y-4">
                {providerRows.map((row) => (
                  <PricingRowForm key={`${row.provider}:${row.tier}`} row={row} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function tierLabel(t: ReturnType<typeof useT>, tier: SubscriptionTier): string {
  switch (tier) {
    case "FREE":
      return t.admin.tierFree;
    case "BASIC":
      return t.admin.tierBasic;
    case "PRO":
      return t.admin.tierPro;
    case "FEATURED":
      return t.admin.tierFeatured;
  }
}

function PricingRowForm({ row }: { row: PricingRow }) {
  const t = useT();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const isFree = row.tier === "FREE";

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
      <input type="hidden" name="tier" value={row.tier} />
      <div className="min-w-[6rem]">
        <p className="text-foreground text-sm font-semibold">{tierLabel(t, row.tier)}</p>
        <p className="text-muted-foreground text-xs">{row.currency}</p>
      </div>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">{t.admin.fieldMonthlyPrice}</span>
        <input
          name="monthlyPriceMajor"
          type="number"
          step="0.01"
          min={isFree ? "0" : "0.01"}
          required
          readOnly={isFree}
          defaultValue={isFree ? 0 : toMajor(row.monthlyPriceMinor, row.currency)}
          title={isFree ? t.admin.pricingFreeLocked : undefined}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">{t.admin.fieldYearlyPrice}</span>
        <input
          name="yearlyPriceMajor"
          type="number"
          step="0.01"
          min={isFree ? "0" : "0.01"}
          required
          readOnly={isFree}
          defaultValue={isFree ? 0 : toMajor(row.yearlyPriceMinor, row.currency)}
          title={isFree ? t.admin.pricingFreeLocked : undefined}
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

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">{t.admin.fieldMonthlyRequestCap}</span>
        <input
          name="monthlyRequestCap"
          type="number"
          step="1"
          min="1"
          max="10000"
          placeholder={t.admin.requestCapUnlimited}
          defaultValue={row.monthlyRequestCap ?? ""}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">{t.admin.fieldTrialRequestCap}</span>
        <input
          name="trialRequestCap"
          type="number"
          step="1"
          min="1"
          max="1000"
          required
          defaultValue={row.trialRequestCap}
          className={inputClass}
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          buttonVariants(),
          "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-9 items-center rounded-lg px-4 text-xs font-semibold disabled:opacity-60",
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
