import { ShieldCheck } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

/**
 * "Popular destinations": the countries with reachable clinics, as navy tiles.
 *
 * Renders nothing when there are too few countries to be worth a section — see
 * getHomepageDestinations. Tiles carry no photos yet; when there are licensed
 * photos per country, they go behind the name with a navy scrim.
 */
export function Destinations({
  t,
  codes,
  locale,
}: {
  t: Dictionary["destinations"];
  codes: string[];
  locale: Locale;
}) {
  if (codes.length === 0) return null;

  // Names from the runtime's own CLDR data, in the page's language: the Country
  // table only keeps English names.
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const [first, second, ...rest] = codes;
  const wide = [first, second].filter(Boolean) as string[];

  const tile = (code: string, big: boolean) => (
    <li
      key={code}
      className={
        "bg-teal-deep text-cream flex flex-col justify-between rounded-lg p-6 " +
        (big ? "min-h-56" : "min-h-44")
      }
    >
      <span className={big ? "text-3xl font-bold" : "text-2xl font-bold"}>
        {names.of(code) ?? code}
      </span>
      <span className="text-cream/80 inline-flex items-center gap-1.5 text-sm">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        {t.verified}
      </span>
    </li>
  );

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <h2 className="font-display text-foreground text-2xl font-bold sm:text-3xl">{t.title}</h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t.subtitle}</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">{wide.map((c) => tile(c, true))}</ul>
        {rest.length > 0 && (
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">{rest.map((c) => tile(c, false))}</ul>
        )}
      </div>
    </section>
  );
}
