import { notFound, redirect } from "next/navigation";
import { ArrowRight, Phone, StickyNote, User } from "lucide-react";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { LocaleLink as Link } from "@/i18n/locale-link";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { toMajor } from "@/lib/money";
import { formatPhoneForDisplay } from "@/lib/phone";
import { clinicLeadStage, decidedElsewhere as wasDecidedElsewhere } from "@/lib/clinic-lead-stage";
import { getClinicForCurrentUser } from "@/server/clinic-account";
import { StatusBadge } from "@/components/request/status-badge";
import { QuoteStatusActions } from "@/components/clinics/quote-status-actions";
import { ClinicQuotePanel } from "@/components/clinics/clinic-quote-panel";
import { MedicalFileViewer, medicalFileKind } from "@/components/clinics/medical-file-viewer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.clinics.reqMetaTitle };
}

/**
 * One incoming request as the clinic works it: the patient's documents on one
 * side, the quote builder on the other.
 *
 * Shown only to the clinic the request was delivered to. Anyone else — another
 * clinic, a patient guessing ids — gets the same 404 as a request that does not
 * exist.
 */
export default async function ClinicRequestPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getDictionary(locale);

  const clinic = await getClinicForCurrentUser();
  if (!clinic) redirect(`/${locale}/clinics/dashboard`);

  const rd = await db.requestDentist.findUnique({
    where: { id },
    select: {
      id: true,
      dentistId: true,
      emailSent: true,
      sentAt: true,
      quoteToken: true,
      quote: {
        select: {
          status: true,
          amountMinor: true,
          currency: true,
          note: true,
          includes: true,
          accommodationNights: true,
          tripsRequired: true,
          daysPerTrip: true,
          weeksBetweenTrips: true,
          sessionsRequired: true,
          weeksBetweenSessions: true,
          warrantyYears: true,
          warrantyNote: true,
        },
      },
      dentist: { select: { country: { select: { currency: true } } } },
      request: {
        select: {
          id: true,
          treatmentFileUrl: true,
          xrayFileUrl: true,
          patientNotes: true,
          // The same details the delivery email already gave this clinic.
          user: { select: { fullName: true, phone: true, phoneVerifiedAt: true } },
          requestDentists: { select: { id: true, quote: { select: { status: true } } } },
        },
      },
    },
  });
  // Delivered to THIS clinic, or it does not exist as far as this clinic knows.
  if (!rd || rd.dentistId !== clinic.id || !rd.emailSent) notFound();

  const decidedElsewhere = wasDecidedElsewhere(rd.id, rd.request.requestDentists);
  const { stage, tone } = clinicLeadStage({
    status: rd.quote?.status ?? null,
    decidedElsewhere,
  });
  // The same rule as the emailed form: a quote can be written or revised only
  // while the patient has not decided on it.
  const canQuote =
    rd.quoteToken !== null &&
    !decidedElsewhere &&
    (rd.quote === null || rd.quote.status === "PENDING_DECISION");
  const currency = rd.quote?.currency ?? rd.dentist.country.currency;
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const user = rd.request.user;

  const files = [
    { key: "treatment", label: t.requestDetail.treatmentPlan, url: rd.request.treatmentFileUrl },
    { key: "xray", label: t.requestDetail.xray, url: rd.request.xrayFileUrl },
  ].filter((f) => !!f.url);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
      <Link
        href="/clinics/dashboard"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <ArrowRight className="h-3.5 w-3.5 ltr:rotate-180" />
        {t.clinics.reqBack}
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
          {format(t.clinics.reqTitle, { id: rd.request.id.slice(0, 8) })}
        </h1>
        <StatusBadge tone={tone}>{t.clinics.leadStage[stage]}</StatusBadge>
      </header>
      {rd.sentAt && (
        <p className="text-muted-foreground mt-1 text-sm">
          {format(t.clinics.dashLeadReceived, { date: dateFmt.format(rd.sentAt) })}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_26rem]">
        {/* The patient and their documents. */}
        <div className="space-y-6">
          <section className="border-border/60 bg-card grid gap-4 rounded-2xl border p-5 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <User className="text-teal-deep mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">{t.clinics.reqPatient}</p>
                <p className="text-foreground font-semibold">
                  {user?.fullName ?? t.quoteForm.fallbackPatient}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="text-teal-deep mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">{t.clinics.reqPhone}</p>
                {user?.phone ? (
                  <a
                    href={`tel:${user.phone}`}
                    dir="ltr"
                    className="text-foreground font-semibold underline-offset-4 hover:underline"
                  >
                    {formatPhoneForDisplay(user.phone)}
                  </a>
                ) : (
                  <p className="text-foreground font-semibold">—</p>
                )}
                {user?.phone && (
                  <p className="text-muted-foreground text-xs">
                    {user.phoneVerifiedAt
                      ? t.clinics.reqPhoneVerified
                      : t.clinics.reqPhoneUnverified}
                  </p>
                )}
              </div>
            </div>
            {rd.request.patientNotes && (
              <div className="flex items-start gap-3 sm:col-span-2">
                <StickyNote className="text-teal-deep mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">{t.clinics.reqNotes}</p>
                  <p className="text-foreground text-sm whitespace-pre-wrap">
                    {rd.request.patientNotes}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-foreground text-lg font-bold">{t.clinics.reqFiles}</h2>
            {files.map((f) => (
              <MedicalFileViewer
                key={f.key}
                src={`/api/files/${rd.request.id}/${f.key}`}
                label={f.label}
                kind={medicalFileKind(f.url)}
                openLabel={t.clinics.reqOpenFull}
              />
            ))}
          </section>
        </div>

        {/* The quote — or, once decided, what happens next. */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <h2 className="font-display text-foreground text-lg font-bold">
            {t.clinics.reqQuoteTitle}
          </h2>
          {canQuote ? (
            <ClinicQuotePanel
              token={rd.quoteToken!}
              currencyLabel={currency}
              initial={{
                amount: rd.quote ? toMajor(rd.quote.amountMinor ?? 0, currency) : null,
                note: rd.quote?.note ?? null,
                includes: rd.quote?.includes ?? [],
                accommodationNights: rd.quote?.accommodationNights ?? null,
                tripsRequired: rd.quote?.tripsRequired ?? 1,
                daysPerTrip: rd.quote?.daysPerTrip ?? 1,
                weeksBetweenTrips: rd.quote?.weeksBetweenTrips ?? null,
                sessionsRequired: rd.quote?.sessionsRequired ?? 1,
                weeksBetweenSessions: rd.quote?.weeksBetweenSessions ?? null,
                warrantyYears: rd.quote?.warrantyYears ?? null,
                warrantyNote: rd.quote?.warrantyNote ?? null,
              }}
            />
          ) : (
            <div className="border-border/60 bg-card space-y-3 rounded-2xl border p-5 text-sm">
              <p className="text-muted-foreground">
                {stage === "missed" ? t.clinics.reqMissed : t.clinics.reqQuoteClosed}
              </p>
              {rd.quote && <QuoteStatusActions requestDentistId={rd.id} status={rd.quote.status} />}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
