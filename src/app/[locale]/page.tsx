import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Benefits } from "@/components/sections/benefits";
import { ComparingQuotes } from "@/components/sections/comparing-quotes";
import { Faq } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";
import { getDictionary } from "@/i18n/get-dictionary";
import { getHomepageStats } from "@/lib/homepage-stats";
import { getHomepageDestinations } from "@/lib/homepage-destinations";
import { Destinations } from "@/components/sections/destinations";
import { isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // Loaded once here and passed down, so every section stays a server component
  // with no client-side i18n cost.
  const t = await getDictionary(locale);
  // Read on every request rather than baked in: the hero shows what is true
  // now, and upgrades itself from mechanism claims to measurements the moment
  // there is enough evidence. See src/lib/homepage-stats.ts.
  const [stats, destinations] = await Promise.all([getHomepageStats(), getHomepageDestinations()]);

  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero t={t.hero} labels={t.labels} stats={stats} locale={locale} />
        <Destinations t={t.destinations} codes={destinations} locale={locale} />
        <HowItWorks t={t.howItWorks} />
        <Benefits t={t.benefits} />
        <ComparingQuotes t={t.comparingQuotes} />
        <Faq t={t.faq} />
        <FinalCta t={t.finalCta} />
      </main>
      <Footer />
    </>
  );
}
