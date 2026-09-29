import type { Dictionary } from "@/i18n/get-dictionary";
import type { Specialty } from "@/lib/constants";
import { StartSearch } from "./start-search";

export function Hero({
  t,
  specialties,
  countries,
}: {
  t: Dictionary["hero"];
  specialties: { value: Specialty; label: string }[];
  countries: { code: string; name: string }[];
}) {
  const searchLabels = {
    treatmentLabel: t.searchTreatmentLabel,
    treatmentAny: t.searchTreatmentAny,
    whereLabel: t.searchWhereLabel,
    whereAnywhere: t.searchWhereAnywhere,
    submit: t.searchSubmit,
  };

  return (
    <section>
      {/* Navy band. The search box straddles its bottom edge — half on navy,
          half on the page — which is the design system's signature move. */}
      <div className="bg-teal-deep pb-14 sm:pb-20">
        <div className="mx-auto max-w-6xl px-6 pt-8 sm:pt-16 lg:px-10">
          <h1 className="font-display text-cream font-bold tracking-tight text-balance">
            <span className="text-cream/80 block text-base font-medium sm:text-xl">
              {t.headlineTop}
            </span>
            <span className="mt-2 block text-[2rem] leading-[1.1] sm:mt-3 sm:text-5xl lg:text-6xl">
              {t.headlineMain} <span className="text-highlight block">{t.headlineAccent}</span>
            </span>
          </h1>
          <p className="text-cream/80 mt-4 text-sm sm:text-base">{t.reassurance}</p>
        </div>
      </div>

      <div className="mx-auto -mt-10 max-w-6xl px-6 lg:px-10">
        <StartSearch labels={searchLabels} specialties={specialties} countries={countries} />
        <p className="text-muted-foreground mt-3 text-sm">{t.searchHint}</p>
      </div>
    </section>
  );
}
