import { ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { DentistDirectory } from "@/components/dentists/dentist-directory";
import { PUBLIC_DENTIST_SELECT, publicDentistWhere } from "@/lib/dentist-public";
import { attachCapStatus } from "@/server/dentist-cap";
import { destinationCountryCodes } from "@/lib/travel-scope";
import { getActiveCountries } from "@/lib/countries";
import { withCountryNames } from "@/lib/country-names";
import { START_PREFERENCES_COOKIE, parseStartPreferences } from "@/lib/start-preferences";
import { EMPTY_FILTERS } from "@/components/dentists/dentist-filters";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.requestFlow.dentistsMetaTitle };
}

export const dynamic = "force-dynamic";

export default async function RequestDentistsPage({
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
    select: { id: true, countryCode: true },
  });
  if (!user) redirect("/sign-in");

  const request = await db.request.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      treatmentFileUrl: true,
      xrayFileUrl: true,
      travelScope: true,
      destinationCountries: true,
      requestDentists: { select: { dentistId: true } },
    },
  });

  if (!request || request.userId !== user.id) notFound();

  // Files are a prerequisite for this step — send the user back if they skipped it.
  if (!request.treatmentFileUrl || !request.xrayFileUrl) {
    redirect(`/request/${id}/upload`);
  }

  // What the patient said they would do, not a list frozen when they said it:
  // ANY returns null and therefore adds no condition, so a country activated
  // tomorrow appears here without anyone revisiting old requests.
  const codes = destinationCountryCodes(
    request.travelScope,
    request.destinationCountries,
    user.countryCode,
  );

  const dentistsWithoutCapStatus = await db.dentist.findMany({
    where: {
      ...publicDentistWhere(),
      ...(codes ? { countryCode: { in: codes } } : {}),
    },
    select: PUBLIC_DENTIST_SELECT,
    orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
  });
  const dentists = await attachCapStatus(dentistsWithoutCapStatus);

  // Names, not codes: the filter and the card both read "Israel" rather than "IL".
  const countries = await getActiveCountries();
  const countryNames = Object.fromEntries(
    withCountryNames(countries, locale).map((c) => [c.code, c.name]),
  );

  const initialSelectedIds = request.requestDentists.map((rd) => rd.dentistId);

  // The treatment picked in the homepage search box starts as an ordinary
  // filter the patient can clear — but only when some listed clinic offers it,
  // so the first screen is never an empty list the patient didn't ask for.
  const { specialty } = parseStartPreferences(
    (await cookies()).get(START_PREFERENCES_COOKIE)?.value,
  );
  const initialFilters =
    specialty && dentists.some((d) => d.specialties.includes(specialty))
      ? { ...EMPTY_FILTERS, specialties: [specialty] }
      : undefined;

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-border/60 bg-muted/30 border-b py-12 lg:py-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <p className="eyebrow">{t.requestFlow.dentistsStep}</p>
            <h1 className="font-display text-foreground mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              {t.requestFlow.dentistsTitle}
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl text-lg text-pretty">
              {t.requestFlow.dentistsSubtitle}
            </p>
            {/* The badge sits on every card, so it cannot explain itself. What
                it means is a property of the whole directory, and belongs here
                once rather than repeated on each clinic. */}
            <p className="text-teal-deep mt-4 inline-flex max-w-2xl items-start gap-2 text-sm">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {t.dentists.verifiedExplainer}
            </p>
          </div>
        </section>

        <DentistDirectory
          dentists={dentists}
          requestId={request.id}
          initialSelectedIds={initialSelectedIds}
          initialFilters={initialFilters}
          countryNames={countryNames}
        />
      </main>
      <Footer />
    </>
  );
}
