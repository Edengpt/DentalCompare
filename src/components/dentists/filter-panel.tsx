"use client";

import { useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { translateInsurer, translateLanguage, translateSpecialty } from "@/lib/labels";
import { SPECIALTIES } from "@/lib/constants";
import { useT } from "@/i18n/provider";
import { EMPTY_FILTERS, activeFilterCount, type DentistFilters } from "./dentist-filters";

type Option = { value: string; label: string };

// Past this many options a group folds, so one long list (cities, once there
// are many) doesn't push every other filter below the fold.
const FOLD_AFTER = 6;

export type FilterPanelProps = {
  filters: DentistFilters;
  onChange: (next: DentistFilters) => void;
  cities: string[];
  /** Insurers actually present among the listed clinics. Derived from the data
   * rather than a constant: the valid set differs per country, and several
   * countries have none at all. */
  insurers: string[];
  /** Countries present among the listed clinics, as ISO codes. */
  countries: string[];
  /** Languages present among the listed clinics. */
  languages: string[];
  /** Code to display name, so the filter reads "Israel" and not "IL". */
  countryNames: Record<string, string>;
};

/**
 * The filter groups, laid out as a Booking-style sidebar: every option visible
 * as a checkbox, grouped under a heading, instead of hidden behind a pill. The
 * same panel is the desktop sidebar and the body of the mobile sheet.
 */
export function FilterPanel({
  filters,
  onChange,
  cities,
  insurers,
  countries,
  languages,
  countryNames,
}: FilterPanelProps) {
  const t = useT();
  const set = <K extends keyof DentistFilters>(key: K, value: DentistFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="divide-border/60 divide-y">
      <div className="flex items-center justify-between pb-4">
        <h2 className="font-display text-foreground text-base font-bold">
          {t.dentists.filtersHeading}
        </h2>
        {activeFilterCount(filters) > 0 && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-teal-deep text-xs font-semibold underline-offset-4 hover:underline"
          >
            {t.dentists.clearFilters}
          </button>
        )}
      </div>

      {/* Country first: across borders it is the coarsest cut. Hidden when every
          clinic is in the same country, where it would filter nothing. */}
      {countries.length > 1 && (
        <CheckGroup
          title={t.dentists.filterCountry}
          options={countries.map((c) => ({ value: c, label: countryNames[c] ?? c }))}
          values={filters.countries}
          onChange={(v) => set("countries", v)}
        />
      )}

      {cities.length > 0 && (
        <CheckGroup
          title={t.dentists.filterCity}
          options={cities.map((c) => ({ value: c, label: c }))}
          values={filters.cities}
          onChange={(v) => set("cities", v)}
        />
      )}

      <CheckGroup
        title={t.dentists.filterSpecialty}
        options={SPECIALTIES.map((s) => ({ value: s, label: translateSpecialty(t.labels, s) }))}
        values={filters.specialties}
        onChange={(v) => set("specialties", v)}
      />

      {/* "Clinics I can talk to" — the first thing a cross-border patient
          needs, and the reason spokenLanguages is a closed list. */}
      {languages.length > 0 && (
        <CheckGroup
          title={t.dentists.filterLanguage}
          options={languages.map((l) => ({ value: l, label: translateLanguage(t.labels, l) }))}
          values={filters.languages}
          onChange={(v) => set("languages", v)}
        />
      )}

      {/* Hidden entirely where no listed clinic declares an insurer, which is
          the normal case for countries without a payer system. */}
      {insurers.length > 0 && (
        <CheckGroup
          title={t.dentists.filterInsurer}
          options={insurers.map((i) => ({ value: i, label: translateInsurer(t.labels, i) }))}
          values={filters.insurers}
          onChange={(v) => set("insurers", v)}
        />
      )}

      <Group title={t.dentists.filterExperience}>
        <div className="space-y-1">
          {[
            { value: null, label: t.dentists.experienceAny },
            { value: 5, label: t.dentists.experience5 },
            { value: 10, label: t.dentists.experience10 },
            { value: 15, label: t.dentists.experience15 },
          ].map((o) => (
            <label
              key={String(o.value)}
              className="hover:bg-muted flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm"
            >
              <input
                type="radio"
                name="minExperience"
                checked={filters.minExperience === o.value}
                onChange={() => set("minExperience", o.value)}
                className="accent-teal-deep h-4 w-4"
              />
              <span className={cn(filters.minExperience === o.value && "font-semibold")}>
                {o.label}
              </span>
            </label>
          ))}
        </div>
      </Group>
    </div>
  );
}

/**
 * A titled group of options. Not a fieldset: a legend is drawn on top of the
 * fieldset's border, which put every heading on the divider line above it.
 */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="py-4">
      <p id={id} className="text-foreground mb-2.5 text-sm font-semibold">
        {title}
      </p>
      {children}
    </div>
  );
}

function CheckGroup({
  title,
  options,
  values,
  onChange,
}: {
  title: string;
  options: Option[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const foldable = options.length > FOLD_AFTER;
  // A chosen option never hides behind the fold — the patient would lose sight
  // of why the list is short.
  const shown =
    foldable && !expanded
      ? options.filter((o, i) => i < FOLD_AFTER || values.includes(o.value))
      : options;

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <Group title={title}>
      <ul className="space-y-1">
        {shown.map((o) => {
          const checked = values.includes(o.value);
          return (
            <li key={o.value}>
              <label className="hover:bg-muted flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm">
                <Checkbox checked={checked} onCheckedChange={() => toggle(o.value)} />
                <span className={cn(checked && "font-semibold")}>{o.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {foldable && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-teal-deep mt-1.5 px-1.5 text-xs font-semibold underline-offset-4 hover:underline"
        >
          {expanded ? t.dentists.showLess : t.dentists.showMore}
        </button>
      )}
    </Group>
  );
}
