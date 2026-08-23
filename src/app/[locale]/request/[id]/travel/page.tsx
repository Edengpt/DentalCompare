import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { getActiveCountries } from "@/lib/countries";
import { countryFromPhone } from "@/lib/phone";
import { TravelStep } from "@/components/request/travel-step";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.requestFlow.travelMetaTitle };
}
export const dynamic = "force-dynamic";

export default async function TravelPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true, phone: true, countryCode: true },
  });
  if (!user) redirect("/sign-in");

  const request = await db.request.findUnique({
    where: { id },
    select: { id: true, userId: true, treatmentFileUrl: true, xrayFileUrl: true },
  });
  if (!request || request.userId !== user.id) notFound();

  // The files are a prerequisite for this step, as they are for the one after.
  if (!request.treatmentFileUrl || !request.xrayFileUrl) {
    redirect(`/${locale}/request/${id}/upload`);
  }

  const countries = await getActiveCountries();

  // A guess, not a conclusion. The phone gives a good default; an Israeli living
  // in London keeps an Israeli mobile, so the patient changes it in one click if
  // the number is misleading. Ignored when it names a country we don't operate in.
  const guessed = countryFromPhone(user.phone);
  const defaultCountry =
    guessed && countries.some((c) => c.code === guessed) ? guessed : user.countryCode;

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-border/60 bg-muted/30 border-b py-12 lg:py-16">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <p className="eyebrow">{t.requestFlow.travelStep}</p>
            <h1 className="font-display text-foreground mt-4 text-4xl font-bold tracking-tight text-balance">
              {t.requestFlow.travelTitle}
            </h1>
            <p className="text-muted-foreground mt-4 leading-relaxed text-pretty">
              {t.requestFlow.travelSubtitle}
            </p>
          </div>
        </section>

        <section className="py-12 lg:py-16">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <TravelStep
              requestId={request.id}
              countries={countries.map((c) => ({ code: c.code, nameEn: c.nameEn }))}
              defaultCountry={defaultCountry}
              locale={locale}
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
