"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { saveTravelChoice } from "@/server/travel-actions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const inputClass =
  "border-border/60 bg-background focus:border-teal-deep focus:ring-teal-deep/20 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2";

export function TravelStep({
  requestId,
  countries,
  defaultCountry,
  defaultScope = "LOCAL",
  defaultDestinations = [],
  locale,
}: {
  requestId: string;
  countries: { code: string; nameEn: string }[];
  defaultCountry: string;
  /** Pre-selected radio, e.g. from the homepage search box. */
  defaultScope?: "LOCAL" | "SELECTED" | "ANY";
  /** Countries pre-ticked when the scope is SELECTED. */
  defaultDestinations?: string[];
  locale: string;
}) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scope, setScope] = useState<"LOCAL" | "SELECTED" | "ANY">(defaultScope);

  const SCOPES = [
    { value: "LOCAL", label: t.requestFlow.travelScopeLocal },
    { value: "SELECTED", label: t.requestFlow.travelScopeSelected },
    { value: "ANY", label: t.requestFlow.travelScopeAny },
  ] as const;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveTravelChoice(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/${locale}/request/${requestId}/dentists`);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <input type="hidden" name="requestId" value={requestId} />

      <label className="flex max-w-sm flex-col gap-1.5 text-sm">
        <span className="text-foreground font-medium">{t.requestFlow.travelCountryLabel}</span>
        <select name="countryCode" defaultValue={defaultCountry} className={inputClass}>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.nameEn}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-3">
        <legend className="text-foreground text-sm font-medium">
          {t.requestFlow.travelScopeLabel}
        </legend>
        {SCOPES.map((s) => (
          <label key={s.value} className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="radio"
              name="travelScope"
              value={s.value}
              checked={scope === s.value}
              onChange={() => setScope(s.value)}
              className="accent-teal-deep h-4 w-4"
            />
            <span className="text-foreground">{s.label}</span>
          </label>
        ))}
      </fieldset>

      {/* Only rendered for SELECTED. An always-visible country list would read as
          a filter the patient has to clear, rather than an answer they gave. */}
      {scope === "SELECTED" && (
        <fieldset className="border-border/60 bg-card space-y-3 rounded-lg border p-5">
          <legend className="text-foreground px-1 text-sm font-medium">
            {t.requestFlow.travelDestinationsLabel}
          </legend>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {countries.map((c) => (
              <label key={c.code} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="destinations"
                  value={c.code}
                  defaultChecked={defaultDestinations.includes(c.code)}
                  className="accent-teal-deep h-4 w-4"
                />
                <span className="text-foreground">{c.nameEn}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          buttonVariants(),
          "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-11 items-center rounded-lg px-6 text-sm font-semibold disabled:opacity-60",
        )}
      >
        {isPending ? t.selection.saving : t.requestFlow.travelContinue}
      </button>
    </form>
  );
}
