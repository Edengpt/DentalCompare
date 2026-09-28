import { currentUser } from "@clerk/nextjs/server";
import { CheckCircle2, Clock, AlertTriangle, FileText } from "lucide-react";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { LocaleLink as Link } from "@/i18n/locale-link";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { isClinicVisible, billingBlocker } from "@/lib/subscription";
import { isPayPlusConfigured } from "@/lib/payplus";
import { getClinicForCurrentUser } from "@/server/clinic-account";
import { IncomingRequests } from "@/components/clinics/incoming-requests";
import { clinicLeadStage, decidedElsewhere } from "@/lib/clinic-lead-stage";
import { PendingReview } from "@/components/clinics/pending-review";
import { clinicReviewStage } from "@/lib/clinic-review-stage";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.clinics.dashMetaTitle };
}

/**
 * The clinic's own area.
 *
 * Until this existed a clinic had no account at all: every way back into the
 * site was a magic link in an email it had to still be able to find. This is
 * also the only place the clinic itself is told that its trial ended with no
 * way to charge it — the operator learned that from the admin badge and an
 * email, and the clinic, who is the one who has to act, learned nothing.
 */
export default async function ClinicDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getDictionary(locale);

  const clinic = await getClinicForCurrentUser();

  if (!clinic) {
    const user = await currentUser();
    const email =
      user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? "";
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="font-display text-foreground text-2xl font-bold">
          {t.clinics.dashNoClinicTitle}
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {format(t.clinics.dashNoClinicBody, { email })}
        </p>
        <Link
          href="/clinics/join"
          className="bg-teal-deep text-cream mt-6 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold"
        >
          {t.clinics.dashNoClinicJoin}
        </Link>
      </main>
    );
  }

  const [subscription, documents, leads] = await Promise.all([
    db.clinicSubscription.findUnique({
      where: { dentistId: clinic.id },
      select: {
        status: true,
        plan: true,
        currentPeriodEnd: true,
        trialEndsAt: true,
        trialDays: true,
        trialEndedUnbilledAt: true,
        recurringToken: true,
        setupToken: true,
      },
    }),
    db.clinicDocument.findMany({
      where: { dentistId: clinic.id },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, kind: true, rejectedAt: true, rejectionReason: true },
    }),
    // Only leads actually delivered. A row whose email has not gone out yet is
    // not something the clinic can act on, and showing it would promise a
    // patient it cannot reach.
    db.requestDentist.findMany({
      where: { dentistId: clinic.id, emailSent: true },
      orderBy: { sentAt: "desc" },
      take: 50,
      select: {
        id: true,
        sentAt: true,
        quote: { select: { status: true } },
        // Only to derive "the patient already chose another clinic" — which
        // clinic, and at what price, never leaves the server.
        request: {
          select: {
            id: true,
            requestDentists: { select: { id: true, quote: { select: { status: true } } } },
          },
        },
      },
    }),
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const listed =
    clinic.isActive && clinic.licenceVerifiedAt !== null && isClinicVisible(subscription);

  // Asked of the same helper the cron and the operator's email ask, rather than
  // re-derived from recurringToken here. Two hand-written copies of one rule is
  // how the home page came to count clinics the directory had stopped showing.
  const blocker = subscription
    ? billingBlocker({
        payplusConfigured: isPayPlusConfigured(),
        recurringToken: subscription.recurringToken,
      })
    : null;

  const trialLine =
    subscription?.status === "TRIALING" && subscription.trialEndsAt
      ? format(t.clinics.dashTrialEnds, { date: dateFmt.format(subscription.trialEndsAt) })
      : subscription?.currentPeriodEnd
        ? format(t.clinics.dashSubValidUntil, {
            date: dateFmt.format(subscription.currentPeriodEnd),
          })
        : null;

  // Until approval, the first thing the clinic sees is where its application
  // stands — the same timeline it saw right after submitting.
  const reviewStage = clinicReviewStage({ approvedAt: clinic.approvedAt, documents });
  const returned = documents
    .filter((d) => d.rejectedAt)
    .map((d) => ({ kind: d.kind, reason: d.rejectionReason }));

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <header>
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
          {clinic.clinicName}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.clinics.dashTitle}</p>
      </header>

      {reviewStage && (
        <PendingReview
          email={clinic.email}
          trialDays={subscription?.trialDays ?? 0}
          returned={returned}
          replaceHref={
            clinic.documentToken && returned.length > 0
              ? `/clinics/documents/${clinic.documentToken}`
              : null
          }
        />
      )}

      <section className="border-border/60 bg-card rounded-2xl border p-6">
        <h2 className="text-foreground font-semibold">{t.clinics.dashStatusHeading}</h2>
        <ul className="mt-4 space-y-2.5 text-sm">
          <StatusRow
            ok={clinic.approvedAt !== null}
            okText={t.clinics.dashApproved}
            pendingText={t.clinics.dashPendingApproval}
          />
          <StatusRow
            ok={clinic.licenceVerifiedAt !== null}
            okText={t.clinics.dashLicenceVerified}
            pendingText={t.clinics.dashLicencePending}
          />
          <StatusRow
            ok={listed}
            okText={t.clinics.dashInDirectory}
            pendingText={t.clinics.dashNotInDirectory}
          />
        </ul>
        {clinic.approvedAt === null && (
          <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
            {t.clinics.dashPendingApprovalHint}
          </p>
        )}
        {clinic.approvedAt !== null && !listed && (
          <p className="text-muted-foreground mt-4 text-xs">{t.clinics.dashNotInDirectoryHint}</p>
        )}
      </section>

      <section className="border-border/60 bg-card rounded-2xl border p-6">
        <h2 className="text-foreground font-semibold">{t.clinics.dashSubHeading}</h2>
        {!subscription ? (
          <p className="text-muted-foreground mt-3 text-sm">{t.clinics.dashSubNone}</p>
        ) : (
          <div className="mt-3 space-y-3 text-sm">
            <p className="text-foreground">
              {subscription.status === "TRIALING" ? t.clinics.dashSubTrialing : null}
              {trialLine ? (subscription.status === "TRIALING" ? ` · ${trialLine}` : trialLine) : ""}
            </p>

            {/* The alert the clinic could never see before. Which of the two
                sentences it gets depends on whose problem it is: a missing card
                is theirs to fix, an unopened billing provider is ours. */}
            {subscription.trialEndedUnbilledAt && (
              <div className="rounded-xl bg-amber-50 p-4 text-amber-900">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {t.clinics.dashTrialEndedUnbilled}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed">
                  {blocker === "no_card"
                    ? t.clinics.dashTrialEndedNoCard
                    : t.clinics.dashTrialEndedNoProvider}
                </p>
                {blocker === "no_card" && subscription.setupToken && (
                  <Link
                    href={`/clinics/billing/${subscription.setupToken}`}
                    className="bg-teal-deep text-cream mt-3 inline-flex rounded-lg px-4 py-2 text-xs font-semibold"
                  >
                    {t.clinics.dashSetupPayment}
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="border-border/60 bg-card rounded-2xl border p-6">
        <h2 className="text-foreground font-semibold">{t.clinics.dashDocsHeading}</h2>
        {documents.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">{t.clinics.dashDocsNone}</p>
        ) : (
          <ul className="mt-4 space-y-2.5 text-sm">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2.5">
                <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="text-foreground">{doc.kind}</span>
                <span
                  className={
                    doc.rejectedAt
                      ? "ms-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                      : "text-muted-foreground ms-auto text-xs"
                  }
                >
                  {doc.rejectedAt ? t.clinics.dashDocRejected : t.clinics.dashDocOk}
                </span>
              </li>
            ))}
          </ul>
        )}
        {clinic.documentToken && documents.some((d) => d.rejectedAt) && (
          <Link
            href={`/clinics/documents/${clinic.documentToken}`}
            className="text-teal-deep mt-4 inline-flex text-sm font-semibold underline-offset-4 hover:underline"
          >
            {t.clinics.dashDocReplace}
          </Link>
        )}
      </section>

      <section className="border-border/60 bg-card rounded-2xl border p-6">
        <h2 className="text-foreground font-semibold">{t.clinics.dashLeadsHeading}</h2>
        {leads.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            {t.clinics.dashLeadsNone}
          </p>
        ) : (
          <div className="mt-4">
            <IncomingRequests
              leads={leads.map((lead) => ({
                id: lead.id,
                requestId: lead.request.id,
                receivedAt: lead.sentAt,
                ...clinicLeadStage({
                  status: lead.quote?.status ?? null,
                  decidedElsewhere: decidedElsewhere(lead.id, lead.request.requestDentists),
                }),
              }))}
            />
          </div>
        )}
      </section>
    </main>
  );
}

function StatusRow({
  ok,
  okText,
  pendingText,
}: {
  ok: boolean;
  okText: string;
  pendingText: string;
}) {
  return (
    <li className="flex items-center gap-2.5">
      {ok ? (
        <CheckCircle2 className="text-teal-deep h-4 w-4 shrink-0" />
      ) : (
        <Clock className="h-4 w-4 shrink-0 text-amber-600" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>
        {ok ? okText : pendingText}
      </span>
    </li>
  );
}
