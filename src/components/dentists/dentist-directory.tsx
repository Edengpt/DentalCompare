"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DentistModel } from "@/generated/prisma/models";
import { REQUEST_LIMITS } from "@/lib/constants";
import { useT } from "@/i18n/provider";
import { format, plural } from "@/i18n/format";
import { saveRequestDentists } from "@/server/requests";
import { DentistCard } from "./dentist-card";
import { FilterBar, type DentistFilters, EMPTY_FILTERS } from "./filter-bar";
import { SelectionCounter } from "./selection-counter";

type DentistDirectoryProps = {
  dentists: DentistModel[];
  /** When set, the picker is bound to a request: continuing persists the
   * selection and advances to the confirmation step. When omitted, the
   * directory is in standalone browse mode. */
  requestId?: string;
  /** Dentist ids already attached to the request, to prefill the selection. */
  initialSelectedIds?: string[];
};

export function DentistDirectory({
  dentists,
  requestId,
  initialSelectedIds,
}: DentistDirectoryProps) {
  const t = useT();
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const [filters, setFilters] = useState<DentistFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectedIds ?? []));

  const cities = useMemo(() => [...new Set(dentists.map((d) => d.city))].sort(), [dentists]);
  // Insurers come from the listed clinics rather than a constant — the valid
  // set is per-country data now, and several countries have none.
  const insurers = useMemo(
    () => [...new Set(dentists.flatMap((d) => d.insurerAffiliations))].sort(),
    [dentists],
  );

  const filtered = useMemo(() => {
    return dentists.filter((d) => {
      if (filters.city && d.city !== filters.city) return false;
      if (filters.specialties.length && !filters.specialties.some((s) => d.specialties.includes(s)))
        return false;
      if (
        filters.insurers.length &&
        !filters.insurers.some((i) => d.insurerAffiliations.includes(i))
      )
        return false;
      if (filters.minExperience && d.experienceYears < filters.minExperience) return false;
      return true;
    });
  }, [dentists, filters]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= REQUEST_LIMITS.maxDentists) {
        toast.warning(format(t.dentists.maxReached, { max: REQUEST_LIMITS.maxDentists }), {
          description: t.dentists.maxReachedHint,
        });
        return prev;
      }
      next.add(id);
      return next;
    });
  };

  const handleContinue = () => {
    // Standalone browse mode (no request bound yet): nudge the user to start a
    // real request so the selection has somewhere to be saved.
    if (!requestId) {
      toast.info(t.dentists.startRequestFirst, {
        description: plural(t.dentists.startRequestHint, selected.size),
      });
      router.push("/request/new");
      return;
    }

    startSaving(async () => {
      const result = await saveRequestDentists(requestId, [...selected]);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/request/${requestId}/confirm`);
    });
  };

  const atMax = selected.size >= REQUEST_LIMITS.maxDentists;

  return (
    <>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        cities={cities}
        insurers={insurers}
        totalCount={dentists.length}
        filteredCount={filtered.length}
      />

      <div className="mx-auto max-w-7xl px-6 py-10 pb-32 lg:px-10">
        {filtered.length === 0 ? (
          <div className="text-muted-foreground border-border/60 mx-auto max-w-md rounded-3xl border border-dashed p-12 text-center">
            <p className="text-base">{t.dentists.noResults}</p>
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-teal-deep mt-3 text-sm font-semibold underline-offset-4 hover:underline"
            >
              {t.dentists.clearAndRetry}
            </button>
          </div>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((d) => (
              <li key={d.id}>
                <DentistCard
                  dentist={d}
                  isSelected={selected.has(d.id)}
                  onToggle={() => toggle(d.id)}
                  disabled={atMax}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <SelectionCounter selected={selected.size} onContinue={handleContinue} isSaving={isSaving} />
    </>
  );
}
