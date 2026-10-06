import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { ExampleComparison } from "@/components/sections/example-comparison";
import { Faq } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";
import { PopularTreatments } from "@/components/sections/popular-treatments";
import { Destinations } from "@/components/sections/destinations";
import { StartSearchProvider } from "@/components/sections/start-search-context";
import { getDictionary } from "@/i18n/get-dictionary";
import { format, plural } from "@/i18n/format";
import { countryName } from "@/lib/country-names";
import { DESTINATION_PHOTOS } from "@/lib/destination-photos";
import { getHomepageDestinations } from "@/lib/homepage-destinations";
import { SPECIALTIES } from "@/lib/constants";
import { translateSpecialty } from "@/lib/labels";
import { isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // Loaded once here and passed down, so the server sections carry no
  // client-side i18n cost.
  const t = await getDictionary(locale);
  // Read on every request rather than baked in: an admin switching a country on
  // or a clinic's licence being approved shows up on the next visit.
  const destinations = await getHomepageDestinations();

  const specialties = SPECIALTIES.map((value) => ({
    value,
    label: translateSpecialty(t.labels, value),
  }));
  // Busiest first, then alphabetical in the reader's own language. No country
  // is promoted: patients and clinics come from everywhere.
  const collator = new Intl.Collator(locale);
  const named = destinations
    .map((d) => ({ ...d, name: countryName(d.code, locale) }))
    .sort((a, b) => b.clinics - a.clinics || collator.compare(a.name, b.name));
  const countries = named.map((d) => ({ code: d.code, name: d.name }));
  const tiles = named.map((d) => ({
    code: d.code,
    name: d.name,
    clinicsLabel:
      d.clinics === 0 ? t.destinations.joiningSoon : plural(t.destinations.verified, d.clinics),
    photo: DESTINATION_PHOTOS[d.code] ?? null,
  }));

  return (
    <>
      <Header />
      <main className="flex-1">
        <StartSearchProvider>
          <Hero t={t.hero} specialties={specialties} countries={countries} />
          <HowItWorks
            t={t.howItWorks}
            locale={locale}
            art={{
              treatmentPlan: t.upload.treatmentPlanTitle,
              xray: t.upload.xrayTitle,
              verified: t.dentists.verifiedBadge,
              price: t.exampleComparison.rowPrice,
              warranty: t.exampleComparison.rowWarranty,
              clinics: [
                t.exampleComparison.clinicA,
                t.exampleComparison.clinicB,
                t.exampleComparison.clinicC,
              ],
              warranties: [
                t.exampleComparison.clinicAWarranty,
                t.exampleComparison.clinicBWarranty,
                t.exampleComparison.clinicCWarranty,
              ],
            }}
          />
          <PopularTreatments title={t.hero.popularTreatments} specialties={specialties} />
          <Destinations
            title={t.destinations.title}
            subtitle={t.destinations.subtitle}
            showAllLabel={format(t.destinations.showAll, { count: tiles.length })}
            showLessLabel={t.destinations.showLess}
            destinations={tiles}
          />
        </StartSearchProvider>
        <ExampleComparison
          t={t.exampleComparison}
          verifiedPromise={{
            title: t.howItWorks.verifiedTitle,
            body: t.howItWorks.verifiedPromise,
          }}
          locale={locale}
        />
        <Faq t={t.faq} />
        <FinalCta t={t.finalCta} />
      </main>
      <Footer />
    </>
  );
}
