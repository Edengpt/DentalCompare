import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale, intlLocale } from "@/i18n/config";
import { LocaleLink as Link } from "@/i18n/locale-link";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { warrantyEndsAt } from "@/lib/warranty";
import { countryName } from "@/lib/country-names";
import { getPatientTreatment, toQuoteRow } from "@/server/treatments";
import { TreatmentCard } from "@/components/request/treatment-card";
import { QuoteComparison } from "@/components/request/quote-comparison";
import { MedicalFileViewer, medicalFileKind } from "@/components/clinics/medical-file-viewer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.treatments.fileMetaTitle };
}

/**
 * One treatment file, as the patient sees it: the clinic and where the
 * treatment stands, what was agreed, until when it is guaranteed, and the
 * documents it was priced from.
 */
export default async function TreatmentFilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getDictionary(locale);

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect(`/${locale}/sign-in`);
  const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  if (!user) redirect(`/${locale}/sign-in`);

  const treatment = await getPatientTreatment(user.id, id);
  if (!treatment?.quote) notFound();
  const q = treatment.quote;
  const d = treatment.dentist;

  const date = new Intl.DateTimeFormat(intlLocale[locale], { dateStyle: "long" });
  const ends = warrantyEndsAt(q.completedAt, q.warrantyYears);
  const files = [
    {
      key: "treatment",
      label: t.requestDetail.treatmentPlan,
      url: treatment.request.treatmentFileUrl,
    },
    { key: "xray", label: t.requestDetail.xray, url: treatment.request.xrayFileUrl },
  ].filter((f) => f.url);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6 sm:py-12">
        <div>
          <Link
            href="/dashboard/treatments"
            className="text-teal text-sm font-medium hover:underline"
          >
            {t.treatments.backToList}
          </Link>
          <h1 className="font-display text-foreground mt-3 text-2xl font-bold sm:text-3xl">
            {format(t.treatments.fileTitle, { clinic: d.clinicName })}
          </h1>
        </div>

        {/* The warranty first: once the treatment is over, it is the reason
            the patient opens this page. */}
        {q.warrantyYears !== null && q.warrantyYears > 0 && (
          <p className="bg-sand text-foreground flex items-start gap-2.5 rounded-lg p-4 text-sm">
            <ShieldCheck className="text-teal-deep mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {ends
              ? format(t.treatments.warrantyActive, {
                  years: q.warrantyYears,
                  date: date.format(ends),
                })
              : format(t.treatments.warrantyPending, { years: q.warrantyYears })}
          </p>
        )}

        <TreatmentCard
          requestDentistId={treatment.id}
          clinic={{
            clinicName: d.clinicName,
            dentistName: d.dentistName,
            phone: d.phone,
            email: d.email,
            address: d.address,
            city: d.city,
            country: d.country ? countryName(d.country.code, locale, d.country.nameEn) : null,
          }}
          timeline={{
            status: q.status,
            decidedAt: q.decidedAt,
            treatmentStartedAt: q.treatmentStartedAt,
            treatmentStartedBy: q.treatmentStartedBy,
            completionRequestedAt: q.completionRequestedAt,
            completedAt: q.completedAt,
          }}
        />

        <section className="space-y-3">
          <h2 className="font-display text-foreground text-lg font-bold">
            {t.treatments.agreedHeading}
          </h2>
          <QuoteComparison
            t={t}
            locale={locale}
            quotes={[toQuoteRow(treatment, locale)]}
            cheapestId={null}
            patientCurrency={q.currency}
            converted={{}}
          />
        </section>

        {files.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-foreground text-lg font-bold">
              {t.treatments.documentsHeading}
            </h2>
            {files.map((f) => (
              <MedicalFileViewer
                key={f.key}
                src={`/api/files/${treatment.request.id}/${f.key}`}
                label={f.label}
                kind={medicalFileKind(f.url)}
                openLabel={t.clinics.reqOpenFull}
              />
            ))}
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
