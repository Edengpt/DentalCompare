import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale, intlLocale } from "@/i18n/config";
import { LocaleLink as Link } from "@/i18n/locale-link";
import { format } from "@/i18n/format";
import { formatPhoneForDisplay } from "@/lib/phone";
import { warrantyEndsAt } from "@/lib/warranty";
import { getClinicForCurrentUser } from "@/server/clinic-account";
import { listClinicPatients } from "@/server/treatments";
import { TreatmentStatus } from "@/components/treatments/treatment-status";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.treatments.clinicMetaTitle };
}

/**
 * "My patients": everyone who approved one of this clinic's quotes, with the
 * treatments done HERE. What the same patient did at other clinics is theirs
 * to know, not this clinic's.
 */
export default async function ClinicPatientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getDictionary(locale);

  const clinic = await getClinicForCurrentUser();
  if (!clinic) redirect(`/${locale}/clinics/dashboard`);
  const patients = await listClinicPatients(clinic.id);
  const date = new Intl.DateTimeFormat(intlLocale[locale], { dateStyle: "medium" });

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/clinics/dashboard" className="text-teal text-sm font-medium hover:underline">
          {t.treatments.backToClinicArea}
        </Link>
        <h1 className="font-display text-foreground mt-3 text-2xl font-bold sm:text-3xl">
          {t.treatments.clinicTitle}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.treatments.clinicSubtitle}</p>

        {patients.length === 0 ? (
          <div className="border-border/60 bg-card mt-8 rounded-lg border border-dashed p-10 text-center">
            <Users className="text-teal-deep mx-auto h-8 w-8" aria-hidden="true" />
            <p className="text-muted-foreground mt-3 text-sm">{t.treatments.clinicEmpty}</p>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {patients.map(({ user, treatments }) => (
              <li key={user.id} className="border-border/60 bg-card rounded-lg border p-4">
                <p className="text-foreground font-semibold">
                  {user.fullName ?? t.emails.patientFallback}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs" dir="ltr">
                  {[user.email, formatPhoneForDisplay(user.phone)].filter(Boolean).join(" · ")}
                </p>
                <ul className="divide-border/60 mt-3 divide-y border-t">
                  {treatments.map((tr) => {
                    const q = tr.quote!;
                    const ends = warrantyEndsAt(q.completedAt, q.warrantyYears);
                    return (
                      <li key={tr.id}>
                        <Link
                          href={`/clinics/requests/${tr.id}`}
                          className="hover:bg-muted/40 -mx-2 flex items-center justify-between gap-3 rounded-sm px-2 py-3"
                        >
                          <span className="text-muted-foreground text-xs">
                            {q.decidedAt &&
                              format(t.treatments.approvedOn, { date: date.format(q.decidedAt) })}
                            {ends &&
                              ` · ${format(t.treatments.warrantyUntil, { date: date.format(ends) })}`}
                          </span>
                          <TreatmentStatus status={q.status} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
