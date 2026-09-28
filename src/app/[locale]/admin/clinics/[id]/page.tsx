import { notFound } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Clock,
  FileSignature,
  Globe,
  Languages,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { LocaleLink as Link } from "@/i18n/locale-link";
import { format } from "@/i18n/format";
import { requireAdmin } from "@/server/admin";
import { db } from "@/lib/db";
import { pendingClinicsWhere } from "@/lib/clinic-approval";
import { adminReviewStage } from "@/lib/clinic-review-stage";
import {
  translateInsurer,
  translateLanguage,
  translateSpecialty,
  translateTreatment,
} from "@/lib/labels";
import { StatusBadge } from "@/components/request/status-badge";
import { MedicalFileViewer } from "@/components/clinics/medical-file-viewer";
import { ClinicReviewActions } from "@/components/admin/clinic-review-actions";
import { RequestDocumentsForm } from "@/components/admin/request-documents-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.admin.metaClinics };
}
export const dynamic = "force-dynamic";

/**
 * Review of one pending clinic: everything it declared on one side, its licence
 * documents open on the other, and the decision beneath them. The documents sit
 * on the same screen as the approve button on purpose — the decision is "does
 * this licence look real", and it should never be made from a list of links.
 */
export default async function AdminClinicReviewPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getDictionary(locale);
  await requireAdmin();

  // Only a clinic still in the queue. An approved one belongs to the clinics
  // list, and one already rejected no longer exists.
  const d = await db.dentist.findFirst({
    where: { id, ...pendingClinicsWhere() },
    include: {
      documents: { orderBy: { kind: "asc" } },
      country: { select: { nameEn: true } },
      subscription: { select: { plan: true } },
    },
  });
  if (!d) notFound();

  const { stage, tone } = adminReviewStage(d);
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const join = (values: string[]) => values.join(", ") || "—";

  return (
    <div className="space-y-6">
      <Link
        href="/admin/clinics"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <ArrowRight className="h-3.5 w-3.5 ltr:rotate-180" />
        {t.admin.backToQueue}
      </Link>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
          {d.clinicName}
        </h1>
        <StatusBadge tone={tone}>{t.admin.reviewStage[stage]}</StatusBadge>
        <p className="text-muted-foreground inline-flex w-full items-center gap-1.5 text-xs">
          <Clock className="h-3.5 w-3.5" />
          {format(t.admin.registeredOn, { date: dateFmt.format(d.createdAt) })}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        {/* What the clinic declared. */}
        <section className="border-border/60 bg-card space-y-4 self-start rounded-2xl border p-5">
          <Detail icon={User} label={t.admin.contactPerson} value={d.contactName ?? "—"} />
          <Detail icon={Building2} label={t.admin.colDentist} value={d.dentistName} />
          <Detail icon={Mail} label={t.admin.colEmail} value={d.email} ltr />
          <Detail icon={Phone} label={t.admin.colPhone} value={d.phone} ltr />
          <Detail
            icon={MapPin}
            label={t.admin.address}
            value={`${d.address}${d.city ? `, ${d.city}` : ""}`}
          />
          <Detail
            icon={Globe}
            label={t.admin.colCountry}
            value={d.country?.nameEn ?? d.countryCode}
          />
          <Detail
            icon={Clock}
            label={t.admin.experienceYears}
            value={format(t.admin.years, { count: d.experienceYears })}
          />
          <Detail
            icon={Building2}
            label={t.admin.colSpecialties}
            value={join(d.specialties.map((s) => translateSpecialty(t.labels, s)))}
          />
          <Detail
            icon={Building2}
            label={t.admin.treatments}
            value={join(d.treatments.map((v) => translateTreatment(t.labels, v)))}
          />
          <Detail
            icon={Languages}
            label={t.admin.colLanguages}
            value={join(d.spokenLanguages.map((l) => translateLanguage(t.labels, l)))}
          />
          <Detail
            icon={Building2}
            label={t.admin.colInsurers}
            value={join(d.insurerAffiliations.map((i) => translateInsurer(t.labels, i)))}
          />
          <Detail
            icon={FileSignature}
            label={t.admin.colPlan}
            value={
              d.subscription
                ? d.subscription.plan === "YEARLY"
                  ? t.admin.planYearly
                  : t.admin.planMonthly
                : "—"
            }
          />
          <p className="border-border/60 text-muted-foreground border-t pt-3 text-xs">
            {d.agreedToTermsAt ? (
              <>
                {format(t.admin.contractSigned, { version: d.termsVersion ?? "—" })}
                {dateFmt.format(d.agreedToTermsAt)}
              </>
            ) : (
              <span className="text-alert">{t.admin.contractMissing}</span>
            )}
          </p>
        </section>

        {/* The documents, open. */}
        <section className="space-y-4">
          <h2 className="text-foreground inline-flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="text-teal-deep h-4 w-4" />
            {t.admin.clinicDocs}
          </h2>
          {d.documents.length === 0 ? (
            // Registration cannot produce this any more, but a clinic created
            // before the gate existed can — and approving one unseen is exactly
            // what the promise forbids.
            <p className="border-alert/40 bg-alert/5 text-alert rounded-2xl border p-4 text-sm">
              {t.admin.clinicDocsNone}
            </p>
          ) : (
            d.documents.map((doc) => (
              <div key={doc.id} className="space-y-1.5">
                <MedicalFileViewer
                  src={`/api/clinics/documents/${doc.id}`}
                  label={doc.kind}
                  kind={doc.contentType === "application/pdf" ? "pdf" : "image"}
                  openLabel={t.clinics.reqOpenFull}
                />
                {/* Without this there is no way to tell a document you have
                    already asked to have replaced from one you have not
                    looked at yet. */}
                {doc.rejectedAt && (
                  <p className="text-alert text-xs">
                    {format(t.admin.docRejectedOn, { date: dateFmt.format(doc.rejectedAt) })}
                    {doc.rejectionReason ? ` — ${doc.rejectionReason}` : ""}
                  </p>
                )}
              </div>
            ))
          )}
        </section>
      </div>

      {/* The decision. */}
      <section className="border-border/60 bg-card space-y-4 rounded-2xl border p-5">
        <h2 className="text-foreground font-semibold">{t.admin.decisionTitle}</h2>
        <ClinicReviewActions
          dentistId={d.id}
          clinicName={d.clinicName}
          isActive={d.isActive}
          canApprove={d.documents.length > 0}
        />
        {d.documents.length > 0 && (
          <RequestDocumentsForm
            dentistId={d.id}
            clinicName={d.clinicName}
            documents={d.documents.map((doc) => ({ id: doc.id, kind: doc.kind }))}
          />
        )}
      </section>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  ltr,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  /** Emails and phone numbers read left-to-right even on a Hebrew page. */
  ltr?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="text-muted-foreground/70 mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          dir={ltr ? "ltr" : undefined}
          className="text-foreground text-sm font-medium break-words"
        >
          {value}
        </p>
      </div>
    </div>
  );
}
