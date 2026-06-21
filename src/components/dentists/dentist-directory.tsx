"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { DentistModel } from "@/generated/prisma/models";
import { REQUEST_LIMITS } from "@/lib/constants";
import { DentistCard } from "./dentist-card";
import { FilterBar, type DentistFilters, EMPTY_FILTERS } from "./filter-bar";
import { SelectionCounter } from "./selection-counter";

type DentistDirectoryProps = {
  dentists: DentistModel[];
};

export function DentistDirectory({ dentists }: DentistDirectoryProps) {
  const [filters, setFilters] = useState<DentistFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const cities = useMemo(() => [...new Set(dentists.map((d) => d.city))].sort(), [dentists]);

  const filtered = useMemo(() => {
    return dentists.filter((d) => {
      if (filters.city && d.city !== filters.city) return false;
      if (filters.specialties.length && !filters.specialties.some((s) => d.specialties.includes(s)))
        return false;
      if (filters.hmos.length && !filters.hmos.some((h) => d.hmoAffiliations.includes(h)))
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
        toast.warning(`ניתן לבחור עד ${REQUEST_LIMITS.maxDentists} רופאים בלבד`, {
          description: "הסירו רופא מהבחירה כדי להוסיף אחר",
        });
        return prev;
      }
      next.add(id);
      return next;
    });
  };

  const handleContinue = () => {
    toast.info("המשך הזרימה (סיכום + שליחה) ייפתח בחלק 7 של הפיתוח", {
      description: `כרגע נבחרו ${selected.size} רופאים`,
    });
  };

  const atMax = selected.size >= REQUEST_LIMITS.maxDentists;

  return (
    <>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        cities={cities}
        totalCount={dentists.length}
        filteredCount={filtered.length}
      />

      <div className="mx-auto max-w-7xl px-6 py-10 pb-32 lg:px-10">
        {filtered.length === 0 ? (
          <div className="text-muted-foreground border-border/60 mx-auto max-w-md rounded-3xl border border-dashed p-12 text-center">
            <p className="text-base">לא נמצאו רופאים שמתאימים לסינון.</p>
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-teal-deep mt-3 text-sm font-semibold underline-offset-4 hover:underline"
            >
              נקו את הסינון
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

      <SelectionCounter selected={selected.size} onContinue={handleContinue} />
    </>
  );
}
