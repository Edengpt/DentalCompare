"use client";

import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { translateInsurer, translateLanguage, translateSpecialty } from "@/lib/labels";
import { SPECIALTIES } from "@/lib/constants";
import { useT } from "@/i18n/provider";
import { format } from "@/i18n/format";

export type DentistFilters = {
  city: string | null;
  countries: string[];
  languages: string[];
  specialties: string[];
  insurers: string[];
  minExperience: number | null;
};

export const EMPTY_FILTERS: DentistFilters = {
  city: null,
  countries: [],
  languages: [],
  specialties: [],
  insurers: [],
  minExperience: null,
};

type FilterBarProps = {
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
  totalCount: number;
  filteredCount: number;
};

export function FilterBar({
  filters,
  onChange,
  cities,
  insurers,
  countries,
  languages,
  countryNames,
  totalCount,
  filteredCount,
}: FilterBarProps) {
  const t = useT();
  const EXPERIENCE_OPTIONS = [
    { value: 5, label: t.dentists.experience5 },
    { value: 10, label: t.dentists.experience10 },
    { value: 15, label: t.dentists.experience15 },
  ];
  const hasFilters =
    filters.city ||
    filters.countries.length ||
    filters.languages.length ||
    filters.specialties.length ||
    filters.insurers.length ||
    filters.minExperience;

  return (
    <div className="bg-background/85 border-border/60 sticky top-16 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-6 py-3 lg:px-10">
        {/* City */}
        <SinglePopover
          label={t.dentists.filterCity}
          value={filters.city}
          options={cities.map((c) => ({ value: c, label: c }))}
          onChange={(v) => onChange({ ...filters, city: v })}
        />

        {/* Specialty */}
        <MultiPopover
          label={t.dentists.filterSpecialty}
          values={filters.specialties}
          options={SPECIALTIES.map((s) => ({
            value: s,
            label: translateSpecialty(t.labels, s),
          }))}
          onChange={(values) => onChange({ ...filters, specialties: values })}
          renderSelected={(s) => translateSpecialty(t.labels, s)}
        />

        {/* Insurer — hidden entirely where no listed clinic declares one, which
            is the normal case for countries without a payer system. */}
        {/* Country first: across borders it is the coarsest cut, and the one a
            patient reaches for before speciality or insurer. Hidden when every
            clinic is in the same country, where it would filter nothing. */}
        {countries.length > 1 && (
          <MultiPopover
            label={t.dentists.filterCountry}
            values={filters.countries}
            options={countries.map((c) => ({ value: c, label: countryNames[c] ?? c }))}
            onChange={(values) => onChange({ ...filters, countries: values })}
            renderSelected={(c) => countryNames[c] ?? c}
          />
        )}

        {/* "Clinics I can talk to" — the first thing a cross-border patient
            needs, and the reason spokenLanguages is a closed list. */}
        {languages.length > 0 && (
          <MultiPopover
            label={t.dentists.filterLanguage}
            values={filters.languages}
            options={languages.map((l) => ({ value: l, label: translateLanguage(t.labels, l) }))}
            onChange={(values) => onChange({ ...filters, languages: values })}
            renderSelected={(l) => translateLanguage(t.labels, l)}
          />
        )}

        {insurers.length > 0 && (
          <MultiPopover
            label={t.dentists.filterInsurer}
            values={filters.insurers}
            options={insurers.map((i) => ({ value: i, label: translateInsurer(t.labels, i) }))}
            onChange={(values) => onChange({ ...filters, insurers: values })}
            renderSelected={(i) => translateInsurer(t.labels, i)}
          />
        )}

        {/* Experience */}
        <SinglePopover
          label={t.dentists.filterExperience}
          value={filters.minExperience ? String(filters.minExperience) : null}
          options={EXPERIENCE_OPTIONS.map((o) => ({
            value: String(o.value),
            label: o.label,
          }))}
          onChange={(v) => onChange({ ...filters, minExperience: v ? Number(v) : null })}
        />

        {hasFilters && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-muted-foreground hover:text-foreground ms-auto inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
          >
            <X className="h-3 w-3" />
            {t.dentists.clearFilters}
          </button>
        )}

        <span className="text-muted-foreground ms-2 text-xs">
          {format(t.dentists.resultCount, { shown: filteredCount, total: totalCount })}
        </span>
      </div>
    </div>
  );
}

/* --- Popover building blocks --- */

type Option = { value: string; label: string };

function SinglePopover({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: Option[];
  onChange: (v: string | null) => void;
}) {
  const t = useT();
  const selected = options.find((o) => o.value === value);
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "border-border bg-background hover:border-teal-deep/40 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
          selected && "border-teal-deep/60 bg-teal-deep/8 text-teal-deep",
        )}
      >
        <span>{selected ? `${label}: ${selected.label}` : label}</span>
        <ChevronDown className="h-3 w-3" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <ul className="space-y-0.5">
          {value && (
            <li>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-muted-foreground hover:bg-muted block w-full rounded-md px-3 py-1.5 text-start text-xs"
              >
                {format(t.dentists.clearOne, { label })}
              </button>
            </li>
          )}
          {options.map((o) => {
            const isSelected = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => onChange(o.value)}
                  className={cn(
                    "hover:bg-muted block w-full rounded-md px-3 py-1.5 text-start text-sm transition-colors",
                    isSelected && "bg-teal-deep/10 text-teal-deep font-semibold",
                  )}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function MultiPopover({
  label,
  values,
  options,
  onChange,
  renderSelected,
}: {
  label: string;
  values: string[];
  options: Option[];
  onChange: (v: string[]) => void;
  renderSelected: (v: string) => string;
}) {
  const t = useT();
  const hasSelected = values.length > 0;

  const toggleValue = (v: string) => {
    if (values.includes(v)) {
      onChange(values.filter((x) => x !== v));
    } else {
      onChange([...values, v]);
    }
  };

  const summary = hasSelected
    ? values.length === 1
      ? `${label}: ${renderSelected(values[0])}`
      : `${label}: ${values.length}`
    : label;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "border-border bg-background hover:border-teal-deep/40 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
          hasSelected && "border-teal-deep/60 bg-teal-deep/8 text-teal-deep",
        )}
      >
        <span>{summary}</span>
        <ChevronDown className="h-3 w-3" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-2">
        <ul className="space-y-0.5">
          {options.map((o) => {
            const checked = values.includes(o.value);
            return (
              <li key={o.value}>
                <label className="hover:bg-muted flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm">
                  <Checkbox checked={checked} onCheckedChange={() => toggleValue(o.value)} />
                  <span className={cn(checked && "font-semibold")}>{o.label}</span>
                </label>
              </li>
            );
          })}
          {hasSelected && (
            <li className="border-border/60 mt-1 border-t pt-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-muted-foreground hover:bg-muted block w-full rounded-md px-3 py-1.5 text-start text-xs"
              >
                {t.dentists.clear}
              </button>
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
