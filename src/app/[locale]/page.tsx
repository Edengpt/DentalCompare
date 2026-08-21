import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Benefits } from "@/components/sections/benefits";
import { Testimonials } from "@/components/sections/testimonials";
import { Faq } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // Loaded once here and passed down, so every section stays a server component
  // with no client-side i18n cost.
  const t = await getDictionary(locale);

  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero t={t.hero} />
        <HowItWorks t={t.howItWorks} />
        <Benefits t={t.benefits} />
        <Testimonials t={t.testimonials} />
        <Faq t={t.faq} />
        <FinalCta t={t.finalCta} />
      </main>
      <Footer />
    </>
  );
}
