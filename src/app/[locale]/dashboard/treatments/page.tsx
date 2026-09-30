import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { FolderHeart } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale, intlLocale } from "@/i18n/config";
import { LocaleLink as Link } from "@/i18n/locale-link";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { warrantyEndsAt } from "@/lib/warranty";
import { countryName } from "@/lib/country-names";
import { listPatientTreatments } from "@/server/treatments";
import { TreatmentStatus } from "@/components/treatments/treatment-status";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.treatments.patientMetaTitle };
}

/** "My treatments": every treatment the patient approved, at any clinic. */
export default async function MyTreatmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getDictionary(locale);

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect(`/${locale}/sign-in`);
  const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  const treatments = user ? await listPatientTreatments(user.id) : [];

  const date = new Intl.DateTimeFormat(intlLocale[locale], { dateStyle: "medium" });

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/dashboard" className="text-teal text-sm font-medium hover:underline">
          {t.treatments.backToDashboard}
        </Link>
        <h1 className="font-display text-foreground mt-3 text-2xl font-bold sm:text-3xl">
          {t.treatments.patientTitle}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.treatments.patientSubtitle}</p>

        {treatments.length === 0 ? (
          <div className="border-border/60 bg-card mt-8 rounded-lg border border-dashed p-10 text-center">
            <FolderHeart className="text-teal-deep mx-auto h-8 w-8" aria-hidden="true" />
            <p className="text-muted-foreground mt-3 text-sm">{t.treatments.patientEmpty}</p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {treatments.map((tr) => {
              const q = tr.quote!;
              const ends = warrantyEndsAt(q.completedAt, q.warrantyYears);
              return (
                <li key={tr.id}>
                  <Link
                    href={`/dashboard/treatments/${tr.id}`}
                    className="border-border/60 bg-card hover:border-teal/60 block rounded-lg border p-4 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-foreground font-semibold">{tr.dentist.clinicName}</p>
                        <p className="text-muted-foreground text-xs">
                          {[
                            tr.dentist.city,
                            tr.dentist.country
                              ? countryName(
                                  tr.dentist.country.code,
                                  locale,
                                  tr.dentist.country.nameEn,
                                )
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" ✦ ")}
                        </p>
                      </div>
                      <TreatmentStatus status={q.status} />
                    </div>
                    <p className="text-muted-foreground mt-2 text-xs">
                      {q.decidedAt &&
                        format(t.treatments.approvedOn, { date: date.format(q.decidedAt) })}
                      {ends &&
                        ` · ${format(t.treatments.warrantyUntil, { date: date.format(ends) })}`}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
