import { getConverter } from "@/lib/exchange-rates";
import { QuoteComparison, type ConvertedPrice } from "@/components/request/quote-comparison";
import { TreatmentCard } from "@/components/request/treatment-card";
import { CompletionBanner } from "@/components/request/completion-banner";
import { LocaleLink as Link } from "@/i18n/locale-link";
import { countryName } from "@/lib/country-names";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Users,
  CheckCircle2,
  Clock,
  Mail,
} from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { sortByPrice, cheapestDentistId, responseCounts, type QuoteRow } from "@/lib/quotes";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { ExplainTreatment } from "@/components/request/explain-treatment";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale, intlLocale } from "@/i18n/config";
import { format } from "@/i18n/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.requestDetail.metaTitle };
}

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({
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
    select: { id: true, country: { select: { currency: true } } },
  });
  if (!user) redirect("/sign-in");

  const request = await db.request.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      createdAt: true,
      treatmentFileUrl: true,
      xrayFileUrl: true,
      patientNotes: true,
      requestDentists: {
        select: {
          id: true,
          emailSent: true,
          sentAt: true,
          quote: {
            select: {
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
              status: true,
              rejectedAuto: true,
              decidedAt: true,
              treatmentStartedAt: true,
              treatmentStartedBy: true,
              completionRequestedAt: true,
              completedAt: true,
            },
          },
          dentist: {
            select: {
              id: true,
              dentistName: true,
              clinicName: true,
              city: true,
              // Contact details, shown only once the patient has chosen this
              // clinic — the treatment card below reads them.
              phone: true,
              email: true,
              address: true,
              // Shown beside the price: which country a quote comes from is
              // part of what the patient is comparing.
              country: { select: { code: true, nameEn: true } },
              spokenLanguages: true,
            },
          },
        },
        orderBy: { dentist: { dentistName: "asc" } },
      },
    },
  });

  if (!request || request.userId !== user.id) notFound();

  const dentists = request.requestDentists;

  // The clinic the patient chose, once there is one. Approval rejects every
  // sibling in the same transaction, so there is at most one.
  const chosen = dentists.find(
    (rd) =>
      rd.quote &&
      ["APPROVED", "IN_TREATMENT", "COMPLETION_REQUESTED", "COMPLETED"].includes(rd.quote.status),
  );

  const quoteRows: QuoteRow[] = dentists.map((rd) => ({
    dentistId: rd.dentist.id,
    requestDentistId: rd.id,
    status: rd.quote?.status ?? null,
    dentistName: rd.dentist.dentistName,
    clinicName: rd.dentist.clinicName,
    city: rd.dentist.city,
    amountMinor: rd.quote?.amountMinor ?? null,
    currency: rd.quote?.currency ?? null,
    country: rd.dentist.country
      ? countryName(rd.dentist.country.code, locale, rd.dentist.country.nameEn)
      : null,
    spokenLanguages: rd.dentist.spokenLanguages,
    includes: rd.quote?.includes ?? [],
    accommodationNights: rd.quote?.accommodationNights ?? null,
    tripsRequired: rd.quote?.tripsRequired ?? null,
    daysPerTrip: rd.quote?.daysPerTrip ?? null,
    weeksBetweenTrips: rd.quote?.weeksBetweenTrips ?? null,
    sessionsRequired: rd.quote?.sessionsRequired ?? null,
    weeksBetweenSessions: rd.quote?.weeksBetweenSessions ?? null,
    warrantyYears: rd.quote?.warrantyYears ?? null,
    warrantyNote: rd.quote?.warrantyNote ?? null,
    note: rd.quote?.note ?? null,
    rejectedAuto: rd.quote?.rejectedAuto ?? false,
  }));
  // One converter per page load, handed to the table — which never touches the
  // database itself. Null for a quote with no honest rate: the patient still
  // sees exactly what the clinic named, and nothing beside it.
  const patientCurrency = user.country?.currency ?? "ILS";
  const convertTo = await getConverter(patientCurrency);

  const converted: Record<string, ConvertedPrice> = {};
  for (const q of quoteRows) {
    converted[q.dentistId] =
      q.amountMinor !== null && q.currency ? convertTo(q.amountMinor, q.currency) : null;
  }

  // Rank on the converted figure, never on the raw minor units: ₺5,000 carries
  // a larger integer than €4,000 while being worth about a tenth as much.
  const comparable = (row: (typeof quoteRows)[number]) =>
    converted[row.dentistId]?.minor ?? (row.currency === patientCurrency ? row.amountMinor : null);

  const sortedQuotes = sortByPrice(quoteRows, comparable);
  const cheapestId = cheapestDentistId(quoteRows, comparable);
  const { responded, total } = responseCounts(quoteRows);

  const date = new Intl.DateTimeFormat(intlLocale[isLocale(locale) ? locale : defaultLocale], {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(request.createdAt);

  const isSent = request.status === "SENT" || request.status === "SUBMITTED";
  const filesReady = !!request.treatmentFileUrl && !!request.xrayFileUrl;

  // Where to continue an unfinished request (only relevant when not yet sent).
  const continueHref = !filesReady
    ? `/request/${id}/upload`
    : dentists.length === 0
      ? `/request/${id}/dentists`
      : `/request/${id}/confirm`;

  const fileLinks = [
    {
      icon: FileText,
      label: t.requestDetail.treatmentPlan,
      kind: "treatment",
      present: !!request.treatmentFileUrl,
    },
    { icon: ImageIcon, label: t.requestDetail.xray, kind: "xray", present: !!request.xrayFileUrl },
  ].filter((f) => f.present);

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-border/60 bg-muted/30 border-b py-12 lg:py-16">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              {t.requestDetail.back}
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
                {t.requestDetail.requestLabel} #{request.id.slice(0, 8)}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-sm font-semibold",
                  isSent
                    ? "bg-teal-deep/10 text-teal-deep"
                    : request.status === "FAILED"
                      ? "bg-alert/10 text-alert"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {isSent ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                {t.requestStatus[request.status]}
              </span>
            </div>
            <p className="text-muted-foreground mt-3 text-sm">
              {format(t.requestDetail.createdOn, { date })}
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl space-y-8 px-6 py-10 lg:px-10 lg:py-14">
          {chosen?.quote?.status === "COMPLETION_REQUESTED" && (
            <CompletionBanner requestDentistId={chosen.id} clinicName={chosen.dentist.clinicName} />
          )}

          {chosen?.quote && (
            <TreatmentCard
              requestDentistId={chosen.id}
              clinic={{
                clinicName: chosen.dentist.clinicName,
                dentistName: chosen.dentist.dentistName,
                phone: chosen.dentist.phone,
                email: chosen.dentist.email,
                address: chosen.dentist.address,
                city: chosen.dentist.city,
                country: chosen.dentist.country
                  ? countryName(
                      chosen.dentist.country.code,
                      locale,
                      chosen.dentist.country.nameEn,
                    )
                  : null,
              }}
              timeline={{
                status: chosen.quote.status,
                decidedAt: chosen.quote.decidedAt,
                treatmentStartedAt: chosen.quote.treatmentStartedAt,
                treatmentStartedBy: chosen.quote.treatmentStartedBy,
                completionRequestedAt: chosen.quote.completionRequestedAt,
                completedAt: chosen.quote.completedAt,
              }}
            />
          )}

          {isSent && (
            <section>
              <div className="border-teal-deep/30 bg-teal-deep/5 text-foreground mb-4 flex items-center gap-2.5 rounded-lg border px-5 py-4 text-sm">
                <Mail className="text-teal-deep h-4 w-4 shrink-0" />
                {responded > 0
                  ? format(t.requestDetail.someResponded, { responded, total })
                  : format(t.requestDetail.noneYet, { total })}
              </div>

              {responded > 0 && (
                <QuoteComparison
                  t={t}
                  locale={isLocale(locale) ? locale : defaultLocale}
                  quotes={sortedQuotes}
                  cheapestId={cheapestId}
                  patientCurrency={patientCurrency}
                  converted={converted}
                />
              )}
            </section>
          )}

          {!isSent && (
            <div className="border-border/60 bg-card flex flex-col gap-4 rounded-lg border p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-sm">
                {request.status === "FAILED"
                  ? t.requestDetail.sendFailed
                  : t.requestDetail.notSentYet}
              </p>
              <Link
                href={continueHref}
                className={cn(
                  buttonVariants(),
                  "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-11 shrink-0 items-center gap-2 rounded-lg px-6 font-semibold",
                )}
              >
                {t.requestDetail.continueRequest}
              </Link>
            </div>
          )}

          {/* Files */}
          <section>
            <h2 className="font-display text-foreground mb-3 text-lg font-bold">
              {t.requestDetail.uploadedDocuments}
            </h2>
            {fileLinks.length === 0 ? (
              <p className="text-muted-foreground border-border/60 bg-card rounded-lg border px-5 py-4 text-sm">
                {t.requestDetail.noDocuments}
              </p>
            ) : (
              <ul className="border-border/60 bg-card divide-border/60 divide-y rounded-lg border">
                {fileLinks.map((f) => (
                  <li key={f.label} className="flex items-center justify-between gap-3 p-4">
                    <span className="text-foreground inline-flex items-center gap-2.5 text-sm font-medium">
                      <f.icon className="text-teal-deep h-4 w-4" />
                      {f.label}
                    </span>
                    <a
                      href={`/api/files/${id}/${f.kind}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-deep text-sm font-semibold underline-offset-4 hover:underline"
                    >
                      {t.requestDetail.viewFile}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* AI: explain the treatment plan (on-demand) */}
          {request.treatmentFileUrl && <ExplainTreatment requestId={request.id} />}

          {/* Patient notes */}
          {request.patientNotes && (
            <section>
              <h2 className="font-display text-foreground mb-3 text-lg font-bold">
                {t.requestDetail.patientNotes}
              </h2>
              <p className="border-border/60 bg-card text-foreground rounded-lg border px-5 py-4 text-sm whitespace-pre-wrap">
                {request.patientNotes}
              </p>
            </section>
          )}

          {/* Dentists */}
          <section>
            <h2 className="font-display text-foreground mb-3 inline-flex items-center gap-2 text-lg font-bold">
              <Users className="text-teal-deep h-5 w-5" />
              {format(t.requestDetail.dentistsInRequest, { count: dentists.length })}
            </h2>
            {dentists.length === 0 ? (
              <p className="text-muted-foreground border-border/60 bg-card rounded-lg border px-5 py-4 text-sm">
                {t.requestDetail.noDentists}
              </p>
            ) : (
              <ul className="border-border/60 bg-card divide-border/60 divide-y rounded-lg border">
                {dentists.map((rd) => (
                  <li key={rd.dentist.id} className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-foreground font-semibold">{rd.dentist.dentistName}</p>
                      <p className="text-muted-foreground text-xs">
                        {rd.dentist.clinicName} ✦ {rd.dentist.city}
                      </p>
                    </div>
                    {rd.emailSent && (
                      <span className="text-teal-deep inline-flex items-center gap-1 text-xs font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t.requestDetail.sent}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
