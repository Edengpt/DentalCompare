"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { saveTravelChoice } from "@/server/travel-actions";
import { cn } from "@/lib/utils";
import { format } from "@/i18n/format";
import { canSearchLocally } from "@/lib/travel-scope";
import { buttonVariants } from "@/components/ui/button";

const inputClass =
  "border-border/60 bg-background focus:border-teal-deep focus:ring-teal-deep/20 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2";

export function TravelStep({
  requestId,
  homeCountries,
  countries,
  defaultCountry,
  defaultScope = "LOCAL",
  defaultDestinations = [],
  locale,
}: {
  requestId: string;
  /** Every country, for "where do you live?". */
  homeCountries: { code: string; name: string }[];
  /** Countries with clinics, for the destinations. */
  countries: { code: string; name: string }[];
  defaultCountry: string | null;
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
  const [home, setHome] = useState(defaultCountry ?? "");
  const activeCodes = new Set(countries.map((c) => c.code));
  // Most countries have no clinics yet; "only in my country" would show nobody.
  const localOk = canSearchLocally(home || null, activeCodes);
  const homeName = homeCountries.find((c) => c.code === home)?.name ?? "";

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
        <select
          name="countryCode"
          required
          value={home}
          onChange={(e) => {
            const next = e.target.value;
            setHome(next);
            if (scope === "LOCAL" && !canSearchLocally(next || null, activeCodes)) setScope("ANY");
          }}
          className={inputClass}
        >
          <option value="" disabled>
            {t.requestFlow.travelCountryPlaceholder}
          </option>
          {homeCountries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-3">
        <legend className="text-foreground text-sm font-medium">
          {t.requestFlow.travelScopeLabel}
        </legend>
        {SCOPES.map((s) => {
          const disabled = s.value === "LOCAL" && !localOk;
          const hintId = `${s.value}-hint`;
          return (
            <label
              key={s.value}
              className={cn(
                "flex items-center gap-3 text-sm",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              )}
            >
              <input
                type="radio"
                name="travelScope"
                value={s.value}
                checked={scope === s.value}
                disabled={disabled}
                aria-describedby={disabled ? hintId : undefined}
                onChange={() => setScope(s.value)}
                className="accent-teal-deep h-4 w-4"
              />
              <span className="text-foreground">
                {s.label}
                {disabled && (
                  <span id={hintId} className="text-muted-foreground block text-xs">
                    {homeName
                      ? format(t.requestFlow.travelNoClinicsAtHome, { country: homeName })
                      : t.requestFlow.travelPickCountryFirst}
                  </span>
                )}
              </span>
            </label>
          );
        })}
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
                <span className="text-foreground">{c.name}</span>
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
          "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-12 w-full items-center justify-center rounded-lg px-6 text-sm font-semibold disabled:opacity-60 sm:h-11 sm:w-auto",
        )}
      >
        {isPending ? t.selection.saving : t.requestFlow.travelContinue}
      </button>
    </form>
  );
}
