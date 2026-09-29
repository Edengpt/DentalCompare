"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useT } from "@/i18n/provider";
import { upgradeToPaid } from "@/server/clinic-upgrade";

/**
 * The free clinic's way onto the paid tier: pick monthly or yearly, and go
 * straight to the payment page. Prices are worded on the server and passed in.
 */
export function UpgradePanel({
  body,
  foundingNote,
  monthlyLabel,
  yearlyLabel,
}: {
  body: string;
  foundingNote: string | null;
  monthlyLabel: string;
  yearlyLabel: string;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<"MONTHLY" | "YEARLY" | null>(null);

  const upgrade = (plan: "MONTHLY" | "YEARLY") => {
    setChosen(plan);
    startTransition(async () => {
      const result = await upgradeToPaid(plan);
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
      <p className="text-muted-foreground mt-1 text-sm">{body}</p>
      {foundingNote && (
        <p className="bg-highlight text-on-highlight mt-3 inline-block rounded-sm px-2 py-1 text-xs font-semibold">
          {foundingNote}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => upgrade("MONTHLY")}
          className={button}
        >
          {pending && chosen === "MONTHLY" ? t.selection.saving : monthlyLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => upgrade("YEARLY")}
          className={button}
        >
          {pending && chosen === "YEARLY" ? t.selection.saving : yearlyLabel}
        </button>
      </div>
    </div>
  );
}
