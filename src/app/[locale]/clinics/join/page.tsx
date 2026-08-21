import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { RegistrationForm } from "@/components/clinics/registration-form";
import { getActiveCountries } from "@/lib/countries";

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
          <RegistrationForm countries={countries} />
        </div>
      </main>
      <Footer />
    </>
  );
}
