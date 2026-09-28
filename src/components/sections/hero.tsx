import { LocaleLink as Link } from "@/i18n/locale-link";
import { Show } from "@clerk/nextjs";
import type { Dictionary } from "@/i18n/get-dictionary";
import { SPECIALTIES } from "@/lib/constants";
import { translateSpecialty } from "@/lib/labels";
import { StartSearch } from "./start-search";
import type { Locale } from "@/i18n/config";
import type { HomepageStats } from "@/lib/homepage-stats";
import { formatMoney } from "@/lib/money";

export function Hero({
  t,
  labels,
  stats,
  locale,
}: {
  t: Dictionary["hero"];
  labels: Dictionary["labels"];
  stats: HomepageStats;
  locale: Locale;
}) {
  // Each tile falls back on its own. The clinic count crosses its floor months
  // before ten requests have carried two quotes each, and there is no reason
  // for the first to wait on the third.
  //
  // A measured figure is always accompanied by the label that describes what
  // was measured; the fallback swaps BOTH halves, because "48 שעות" under
  // "of requests answered within 48 hours" would read as a broken number.
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);

  const trustStats = [
    stats.clinics === null
      ? { value: t.statClinicsFallbackValue, label: t.statClinicsFallbackLabel }
      : { value: number(stats.clinics), label: t.statClinicsLabel },

    stats.responseRate === null
      ? { value: t.statResponseFallbackValue, label: t.statResponseFallbackLabel }
      : {
          value: new Intl.NumberFormat(locale, { style: "percent" }).format(
            stats.responseRate / 100,
          ),
          label: t.statResponseLabel,
        },

    stats.medianSpread === null
      ? { value: t.statSpreadFallbackValue, label: t.statSpreadFallbackLabel }
      : {
          value: formatMoney(stats.medianSpread.minor, stats.medianSpread.currency, locale),
          label: t.statSpreadLabel,
        },
  ];

  const specialties = SPECIALTIES.map((value) => ({
    value,
    label: translateSpecialty(labels, value),
  }));
  const searchLabels = {
    treatmentLabel: t.searchTreatmentLabel,
    treatmentAny: t.searchTreatmentAny,
    whereLabel: t.searchWhereLabel,
    whereLocal: t.searchWhereLocal,
    whereAny: t.searchWhereAny,
    submit: t.searchSubmit,
  };

  return (
    <section>
      {/* Navy band. The search box straddles its bottom edge — half on navy,
          half on the page — which is the design system's signature move. */}
      <div className="bg-teal-deep pb-16 sm:pb-20">
        <div className="mx-auto max-w-6xl px-6 pt-12 sm:pt-16 lg:px-10">
          <h1 className="font-display text-cream font-bold tracking-tight text-balance">
            <span className="text-cream/80 block text-lg font-medium sm:text-xl">
              {t.headlineTop}
            </span>
            <span className="mt-3 block text-4xl leading-[1.1] sm:text-5xl lg:text-6xl">
              {t.headlineMain} <span className="text-highlight">{t.headlineAccent}</span>
            </span>
          </h1>
          <p className="text-cream/80 mt-4 text-sm sm:text-base">{t.reassurance}</p>
        </div>
      </div>

      <div className="mx-auto -mt-10 max-w-6xl px-6 lg:px-10">
        {/* Auth-aware: a signed-in visitor must NOT be sent to /sign-up (Clerk
            bounces them back and the button looks broken). */}
        <Show when="signed-out">
          <StartSearch href="/sign-up" labels={searchLabels} specialties={specialties} />
        </Show>
        <Show when="signed-in">
          <StartSearch href="/request/new" labels={searchLabels} specialties={specialties} />
        </Show>

        <p className="text-muted-foreground mt-3 text-sm">
          {t.searchHint}{" "}
          <Link
            href="#how"
            className="text-teal font-semibold underline-offset-4 hover:underline"
          >
            {t.secondaryCta}
          </Link>
        </p>

        {/* Trust strip */}
        <div className="border-border mt-10 grid gap-6 border-t pt-8 sm:grid-cols-3 sm:gap-4">
          {trustStats.map((stat) => (
            <div key={stat.label}>
              <p className="font-display text-teal-deep text-3xl font-bold">{stat.value}</p>
              <p className="text-muted-foreground mt-1 text-sm leading-snug">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
