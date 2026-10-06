"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { DestinationPhoto } from "@/lib/destination-photos";
import { splitDestinations } from "@/lib/split-destinations";
import { useStartSearch } from "./start-search-context";

export type DestinationTile = {
  code: string;
  name: string;
  /** Already worded, e.g. "12 verified clinics" or "Clinics joining soon". */
  clinicsLabel: string;
  /** The capital, when there is a photo for this country. */
  photo: DestinationPhoto | null;
};

/**
 * "Popular destinations": every active country as a navy tile, busiest first.
 * A tile starts the request with that country as the "where?" answer and
 * whatever treatment is already picked.
 *
 * Where there is a photograph of the capital it sits behind the name under a
 * navy scrim, so the white text stays readable over any picture. A country
 * without one keeps the plain navy tile.
 *
 * Only the first three rows show at first; the rest wait behind "Show all".
 * They stay in the HTML (hidden), so search engines still see every link.
 */
export function Destinations({
  title,
  subtitle,
  showAllLabel,
  showLessLabel,
  destinations,
}: {
  title: string;
  subtitle: string;
  /** Already formatted with the number of countries. */
  showAllLabel: string;
  showLessLabel: string;
  destinations: DestinationTile[];
}) {
  const { start } = useStartSearch();
  const [expanded, setExpanded] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const listId = useId();
  if (destinations.length === 0) return null;

  const { wide, shown, hidden, hasMore } = splitDestinations(destinations);

  // `hidden` keeps a collapsed tile in the HTML and out of the tab order.
  const tile = (d: DestinationTile, big: boolean, index: number, hiddenTile = false) => (
    <li key={d.code} className="relative" hidden={hiddenTile}>
      <button
        type="button"
        onClick={() => start({ country: d.code })}
        className={
          "group bg-teal-deep text-cream focus-visible:outline-teal relative flex w-full flex-col justify-between overflow-hidden rounded-lg p-6 text-start focus-visible:outline-2 focus-visible:outline-offset-2 " +
          (big ? "min-h-56" : "min-h-44")
        }
      >
        {d.photo && (
          <>
            <Image
              src={d.photo.src}
              alt=""
              fill
              sizes={big ? "(min-width: 640px) 50vw, 100vw" : "(min-width: 640px) 33vw, 100vw"}
              // The first two tiles are usually on the first screen.
              priority={index < 2}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span
              aria-hidden="true"
              className="from-teal-deep/95 via-teal-deep/55 to-teal-deep/25 absolute inset-0 bg-gradient-to-t"
            />
          </>
        )}
        <span className={"relative " + (big ? "text-3xl font-bold" : "text-2xl font-bold")}>
          {d.name}
        </span>
        <span className="text-cream/90 relative inline-flex items-center gap-1.5 text-sm">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          {d.clinicsLabel}
        </span>
      </button>
      {/* Outside the button: a link cannot live inside one. The licences ask
          for the author, the licence, and a way to find the original. */}
      {d.photo && (
        // The wrapper takes the page's direction, so "end" is always the
        // corner opposite the country name; the credit itself reads LTR.
        <span className="absolute end-3 top-3">
          <a
            href={d.photo.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className="text-cream/70 hover:text-cream block max-w-[12rem] rounded-sm bg-black/30 px-1.5 py-0.5 text-[10px] leading-tight sm:max-w-none"
          >
            <span className="hidden sm:inline">{d.photo.city} · </span>© {d.photo.author} ·{" "}
            {d.photo.license}
          </a>
        </span>
      )}
    </li>
  );

  return (
    <section ref={sectionRef} className="scroll-mt-20 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <h2 className="font-display text-foreground text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">{subtitle}</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">{wide.map((d, i) => tile(d, true, i))}</ul>
        {shown.length > 0 && (
          <ul id={listId} className="mt-4 grid gap-4 sm:grid-cols-3">
            {shown.map((d, i) => tile(d, false, i + 2))}
            {hidden.map((d, i) => tile(d, false, i + 2 + shown.length, !expanded))}
          </ul>
        )}
        {hasMore && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => {
              if (expanded)
                sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              setExpanded(!expanded);
            }}
            className="border-border text-teal-deep hover:bg-sand mt-6 rounded-md border px-4 py-2 text-sm font-semibold"
          >
            {expanded ? showLessLabel : showAllLabel}
          </button>
        )}
      </div>
    </section>
  );
}
