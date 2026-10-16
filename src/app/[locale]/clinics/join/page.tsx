import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { RegistrationForm } from "@/components/clinics/registration-form";
import { getActiveCountries } from "@/lib/countries";
import { withCountryNames } from "@/lib/country-names";
import { getSubscriptionPricing } from "@/lib/subscription-pricing";
import { foundingPriceMinor } from "@/lib/founding";
import { foundingSlotsLeft } from "@/server/founding";
import type { PlanOffer, TierOffer } from "@/components/clinics/plan-picker";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.clinics.joinMetaTitle, description: t.clinics.joinMetaDescription };
}

export default async function ClinicJoinPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);

  // Only active countries: a half-configured one has no currency or payer list
  // and must never reach a clinic filling in this form.
  const countries = await getActiveCountries();
  // Both providers' offers go to the form: the price has to follow the country
  // the clinic picks, in the currency it will actually be charged in.
  const foundingLeft = await foundingSlotsLeft();
  type Row = Awaited<ReturnType<typeof getSubscriptionPricing>>;
  const tierOffer = (row: Row): TierOffer => ({
    cap: row.monthlyRequestCap,
    monthlyMinor: row.monthlyPriceMinor,
    yearlyMinor: row.yearlyPriceMinor,
    founding:
      foundingLeft > 0
        ? {
            monthlyMinor: foundingPriceMinor(row.monthlyPriceMinor, row.currency),
            yearlyMinor: foundingPriceMinor(row.yearlyPriceMinor, row.currency),
          }
        : null,
  });
  const offer = async (provider: "PAYPLUS" | "STRIPE"): Promise<PlanOffer> => {
    const [free, basic, pro] = await Promise.all([
      getSubscriptionPricing(provider, "FREE"),
      getSubscriptionPricing(provider, "BASIC"),
      getSubscriptionPricing(provider, "PRO"),
    ]);
    return {
      currency: basic.currency,
      freeCap: free.monthlyRequestCap,
      // Each paid row carries its own trialDays; the cards and the terms name
      // one trial, so the two paid rows are kept equal (see the 2026-10-16
      // pricing migration). Basic's is the one shown.
      trialDays: basic.trialDays,
      BASIC: tierOffer(basic),
      PRO: tierOffer(pro),
    };
  };
  const [payplus, stripe] = await Promise.all([offer("PAYPLUS"), offer("STRIPE")]);
  const pricing = { PAYPLUS: payplus, STRIPE: stripe };

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-border/60 bg-muted/30 border-b py-6 sm:py-12 lg:py-16">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <p className="eyebrow">{t.clinics.joinEyebrow}</p>
            <h1 className="font-display text-foreground mt-3 text-2xl leading-tight font-bold tracking-tight text-balance sm:mt-4 sm:text-4xl lg:text-5xl">
              {t.clinics.joinTitle}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm text-pretty sm:mt-4 sm:text-lg">
              {t.clinics.joinSubtitle}
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
          <RegistrationForm
            countries={withCountryNames(countries, locale)}
            pricing={pricing}
            foundingLeft={foundingLeft}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
