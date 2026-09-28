"use client";

import type { Specialty } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useStartSearch } from "./start-search-context";

/**
 * Shortcut chips for the treatment question of the search box. Picking one
 * fills the box; picking it again clears it.
 */
export function PopularTreatments({
  title,
  specialties,
}: {
  title: string;
  specialties: { value: Specialty; label: string }[];
}) {
  const { specialty, setSpecialty } = useStartSearch();

  return (
    <section className="pt-14">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <h2 className="font-display text-foreground text-xl font-bold sm:text-2xl">{title}</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {specialties.map((s) => {
            const selected = specialty === s.value;
            return (
              <li key={s.value}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSpecialty(selected ? "" : s.value)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    selected
                      ? "border-teal bg-teal/10 text-teal"
                      : "border-border bg-background text-foreground hover:border-teal hover:text-teal",
                  )}
                >
                  {s.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
