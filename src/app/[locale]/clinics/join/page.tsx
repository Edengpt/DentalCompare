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
import type { PlanOffer } from "@/components/clinics/plan-picker";

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
  const [foundingLeft, payplusFree, payplusBasic, stripeFree, stripeBasic] = await Promise.all([
    foundingSlotsLeft(),
    getSubscriptionPricing("PAYPLUS", "FREE"),
    getSubscriptionPricing("PAYPLUS", "BASIC"),
    getSubscriptionPricing("STRIPE", "FREE"),
    getSubscriptionPricing("STRIPE", "BASIC"),
  ]);
  const offer = (free: typeof payplusFree, basic: typeof payplusBasic): PlanOffer => ({
    currency: basic.currency,
    freeCap: free.monthlyRequestCap,
    basicCap: basic.monthlyRequestCap,
    monthlyMinor: basic.monthlyPriceMinor,
    yearlyMinor: basic.yearlyPriceMinor,
    trialDays: basic.trialDays,
    founding:
      foundingLeft > 0
        ? {
            monthlyMinor: foundingPriceMinor(basic.monthlyPriceMinor, basic.currency),
            yearlyMinor: foundingPriceMinor(basic.yearlyPriceMinor, basic.currency),
          }
        : null,
  });
  const pricing = {
    PAYPLUS: offer(payplusFree, payplusBasic),
    STRIPE: offer(stripeFree, stripeBasic),
  };

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-border/60 bg-muted/30 border-b py-12 lg:py-16">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <p className="eyebrow">{t.clinics.joinEyebrow}</p>
            <h1 className="font-display text-foreground mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              {t.clinics.joinTitle}
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl text-lg text-pretty">
              {t.clinics.joinSubtitle}
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10 lg:py-14">
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
