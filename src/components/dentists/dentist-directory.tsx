"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PublicDentistWithCapStatus } from "@/server/dentist-cap";
import { applyRequestCapFloor } from "./request-cap-filter";
import { REQUEST_LIMITS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { format, plural } from "@/i18n/format";
import { saveRequestDentists } from "@/server/requests";
import { DentistCard } from "./dentist-card";
import { FilterPanel } from "./filter-panel";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  matchesFilters,
  type DentistFilters,
} from "./dentist-filters";
import { SelectionCounter } from "./selection-counter";

type DentistDirectoryProps = {
  dentists: PublicDentistWithCapStatus[];
  /** When set, the picker is bound to a request: continuing persists the
   * selection and advances to the confirmation step. When omitted, the
   * directory is in standalone browse mode. */
  requestId?: string;
  /** Dentist ids already attached to the request, to prefill the selection. */
  initialSelectedIds?: string[];
  /** Country code to display name, so cards and filters read "Israel", not "IL". */
  countryNames: Record<string, string>;
  /** Filters to start from, e.g. the treatment picked on the homepage. */
  initialFilters?: DentistFilters;
};

export function DentistDirectory({
  dentists,
  requestId,
  initialSelectedIds,
  countryNames,
  initialFilters,
}: DentistDirectoryProps) {
  const t = useT();
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const [filters, setFilters] = useState<DentistFilters>(initialFilters ?? EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectedIds ?? []));

  const cities = useMemo(() => [...new Set(dentists.map((d) => d.city))].sort(), [dentists]);
  // Insurers come from the listed clinics rather than a constant — the valid
  // set is per-country data now, and several countries have none.
  const insurers = useMemo(
    () => [...new Set(dentists.flatMap((d) => d.insurerAffiliations))].sort(),
    [dentists],
  );

  const countries = useMemo(
    () => [...new Set(dentists.map((d) => d.countryCode))].sort(),
    [dentists],
  );
  const languages = useMemo(
    () => [...new Set(dentists.flatMap((d) => d.spokenLanguages))].sort(),
    [dentists],
  );

  const filtered = useMemo(
    () => dentists.filter((d) => matchesFilters(d, filters)),
    [dentists, filters],
  );

  // Cap-plus-floor runs after the patient's own filters, not instead of them
  // — it only ever removes or restores clinics within whatever set filters
  // already produced. See request-cap-filter.ts for why the floor is
  // computed this way rather than per city×specialty.
  const visible = useMemo(() => applyRequestCapFloor(filtered), [filtered]);

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = activeFilterCount(filters);

  // The mobile sheet covers the page: the page behind it must not scroll, and
  // Escape has to close it like any other dialog.
  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [sheetOpen]);

  const panel = (
    <FilterPanel
      filters={filters}
      onChange={setFilters}
      cities={cities}
      insurers={insurers}
      countries={countries}
      languages={languages}
      countryNames={countryNames}
    />
  );
  const resultCount = format(t.dentists.resultCount, {
    shown: visible.length,
    total: dentists.length,
  });

  return (
    <>
      {/* Mobile: one button that opens the same panel as a bottom sheet. */}
      <div className="bg-background/85 border-border/60 sticky top-16 z-30 border-b backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-3 px-6 py-3">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={cn(
              "border-border bg-background inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium",
              activeCount > 0 && "border-teal-deep/60 text-teal-deep",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {t.dentists.filtersButton}
            {activeCount > 0 && (
              <span className="bg-teal-deep text-cream inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs">
                {activeCount}
              </span>
            )}
          </button>
          <span className="text-muted-foreground text-xs">{resultCount}</span>
        </div>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={t.dentists.filtersClose}
            onClick={() => setSheetOpen(false)}
            className="animate-in fade-in-0 absolute inset-0 bg-black/40"
          />
          <div className="bg-background animate-in slide-in-from-bottom absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl shadow-2xl duration-300">
            <div className="flex justify-end px-4 pt-3">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label={t.dentists.filtersClose}
                className="text-muted-foreground hover:text-foreground rounded-full p-1.5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 pb-4">{panel}</div>
            <div className="border-border/60 border-t p-4">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="bg-teal-deep text-cream h-12 w-full rounded-lg text-base font-semibold"
              >
                {format(t.dentists.filtersShow, { count: visible.length })}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 pb-32 lg:grid-cols-[16rem_1fr] lg:px-10">
        {/* Desktop: the Booking-style sidebar, following the scroll. */}
        <aside className="border-border/60 bg-sand hidden self-start rounded-lg border p-5 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          {panel}
        </aside>

        <div>
          <p className="text-muted-foreground mb-4 hidden text-sm lg:block">{resultCount}</p>
          {visible.length === 0 ? (
            <div className="text-muted-foreground border-border/60 mx-auto max-w-md rounded-lg border border-dashed p-12 text-center">
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
            <ul className="grid gap-5 md:grid-cols-2">
              {visible.map((d) => (
                <li key={d.id}>
                  <DentistCard
                    dentist={d}
                    countryName={countryNames[d.countryCode] ?? d.countryCode}
                    isSelected={selected.has(d.id)}
                    onToggle={() => toggle(d.id)}
                    disabled={atMax}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <SelectionCounter selected={selected.size} onContinue={handleContinue} isSaving={isSaving} />
    </>
  );
}
