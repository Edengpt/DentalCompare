"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useT } from "@/i18n/provider";
import { upgradeToPaid } from "@/server/clinic-upgrade";

export type UpgradeOption = {
  tier: "BASIC" | "PRO";
  /** One line: the plan, its request allowance and both prices. */
  body: string;
  monthlyLabel: string;
  yearlyLabel: string;
};

/**
 * The free clinic's way onto a paid plan: pick Basic or Pro, monthly or
 * yearly, and go straight to the payment page. Prices are worded on the
 * server and passed in.
 */
export function UpgradePanel({
  options,
  foundingNote,
}: {
  options: UpgradeOption[];
  foundingNote: string | null;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<string | null>(null);

  const upgrade = (tier: "BASIC" | "PRO", plan: "MONTHLY" | "YEARLY") => {
    setChosen(`${tier}:${plan}`);
    startTransition(async () => {
      const result = await upgradeToPaid(tier, plan);
      if (!result.ok) {
        toast.error(result.error);
        setChosen(null);
        return;
      }
      router.push(`/${locale}/clinics/billing/${result.setupToken}`);
    });
  };

  const button =
    "bg-coral hover:bg-teal-deep inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white transition-colors disabled:opacity-60";

  return (
    <div className="border-teal/30 bg-teal/5 rounded-lg border p-4">
      <p className="text-foreground font-semibold">{t.clinics.dashUpgradeTitle}</p>
      {foundingNote && (
        <p className="bg-highlight text-on-highlight mt-2 inline-block rounded-sm px-2 py-1 text-xs font-semibold">
          {foundingNote}
        </p>
      )}
      <div className="mt-3 space-y-4">
        {options.map((o) => (
          <div key={o.tier}>
            <p className="text-muted-foreground text-sm">{o.body}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["MONTHLY", "YEARLY"] as const).map((plan) => (
                <button
                  key={plan}
                  type="button"
                  disabled={pending}
                  onClick={() => upgrade(o.tier, plan)}
                  className={button}
                >
                  {pending && chosen === `${o.tier}:${plan}`
                    ? t.selection.saving
                    : plan === "MONTHLY"
                      ? o.monthlyLabel
                      : o.yearlyLabel}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
