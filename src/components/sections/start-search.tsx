"use client";

import type { Specialty } from "@/lib/constants";
import { useStartSearch } from "./start-search-context";

type Labels = {
  treatmentLabel: string;
  treatmentAny: string;
  whereLabel: string;
  whereAnywhere: string;
  submit: string;
};

/**
 * The yellow search frame from the design system: which treatment, where, go.
 * See StartSearchProvider for what "go" does.
 */
export function StartSearch({
  labels,
  specialties,
  countries,
}: {
  labels: Labels;
  specialties: { value: Specialty; label: string }[];
  countries: { code: string; name: string }[];
}) {
  const { specialty, setSpecialty, country, setCountry, start } = useStartSearch();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    start();
  };

  // On a phone the two questions share one white card split by a hairline, so
  // the yellow frame reads as one control rather than three stacked slabs. From
  // sm up each question is its own white cell again, side by side.
  const field =
    "flex min-h-14 flex-col justify-center gap-0.5 rounded-sm px-4 py-2 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-teal sm:min-h-16 sm:flex-1 sm:basis-56 sm:bg-background";
  const select =
    "text-foreground w-full cursor-pointer border-0 bg-transparent p-0 text-base font-semibold outline-none";

  return (
    <form
      onSubmit={onSubmit}
      className="bg-highlight shadow-card flex flex-col gap-1 rounded-lg p-1 text-start sm:flex-row sm:flex-wrap"
    >
      <div className="bg-background divide-border flex flex-col divide-y rounded-sm sm:contents">
        <label className={field}>
          <span className="text-muted-foreground text-xs">{labels.treatmentLabel}</span>
          <select
            name="specialty"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value as Specialty | "")}
            className={select}
          >
            <option value="">{labels.treatmentAny}</option>
            {specialties.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className={field}>
          <span className="text-muted-foreground text-xs">{labels.whereLabel}</span>
          <select
            name="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={select}
          >
            <option value="">{labels.whereAnywhere}</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="submit"
        className="bg-coral hover:bg-teal-deep focus-visible:outline-teal-deep min-h-12 flex-auto rounded-sm px-8 text-base font-bold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-16 sm:flex-none sm:text-lg"
      >
        {labels.submit}
      </button>
    </form>
  );
}
