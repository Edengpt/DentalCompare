"use client";

import { ShieldCheck } from "lucide-react";
import { useStartSearch } from "./start-search-context";

export type DestinationTile = {
  code: string;
  name: string;
  /** Already worded, e.g. "12 verified clinics" or "Clinics joining soon". */
  clinicsLabel: string;
};

/**
 * "Popular destinations": every active country as a navy tile, busiest first.
 * A tile starts the request with that country as the "where?" answer and
 * whatever treatment is already picked.
 *
 * Tiles carry no photos yet; when there are licensed photos per country, they
 * go behind the name with a navy scrim.
 */
export function Destinations({
  title,
  subtitle,
  destinations,
}: {
  title: string;
  subtitle: string;
  destinations: DestinationTile[];
}) {
  const { start } = useStartSearch();
  if (destinations.length === 0) return null;

  const [first, second, ...rest] = destinations;
  const wide = [first, second].filter(Boolean);

  const tile = (d: DestinationTile, big: boolean) => (
    <li key={d.code}>
      <button
        type="button"
        onClick={() => start({ country: d.code })}
        className={
          "bg-teal-deep text-cream hover:bg-teal focus-visible:outline-teal flex w-full flex-col justify-between rounded-lg p-6 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 " +
          (big ? "min-h-56" : "min-h-44")
        }
      >
        <span className={big ? "text-3xl font-bold" : "text-2xl font-bold"}>{d.name}</span>
        <span className="text-cream/80 inline-flex items-center gap-1.5 text-sm">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          {d.clinicsLabel}
        </span>
      </button>
    </li>
  );

  return (
    <section className="py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <h2 className="font-display text-foreground text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">{subtitle}</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">{wide.map((d) => tile(d, true))}</ul>
        {rest.length > 0 && (
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">{rest.map((d) => tile(d, false))}</ul>
        )}
      </div>
    </section>
  );
}
