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

  const field =
    "bg-background flex min-h-16 flex-1 basis-56 flex-col justify-center gap-0.5 rounded-sm px-4 py-2 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-teal";
  const select =
    "text-foreground w-full cursor-pointer border-0 bg-transparent p-0 text-base font-semibold outline-none";

  return (
    <form
      onSubmit={onSubmit}
      className="bg-highlight shadow-card flex flex-wrap gap-1 rounded-lg p-1 text-start"
    >
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
      <button
        type="submit"
        className="bg-coral hover:bg-teal-deep focus-visible:outline-teal-deep min-h-16 flex-auto rounded-sm px-8 text-lg font-bold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:flex-none"
      >
        {labels.submit}
      </button>
    </form>
  );
}
