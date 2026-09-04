import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Clock,
  FileSignature,
  ShieldCheck,
  User,
} from "lucide-react";
import { requireAdmin } from "@/server/admin";
import { db } from "@/lib/db";
import { translateSpecialty, translateInsurer, translateTreatment } from "@/lib/labels";
import { ClinicReviewActions } from "@/components/admin/clinic-review-actions";
import { RequestDocumentsForm } from "@/components/admin/request-documents-form";
import { pendingClinicsWhere } from "@/lib/clinic-approval";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.admin.metaClinics };
}
export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminClinicsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  await requireAdmin();

  const pending = await db.dentist.findMany({
    where: pendingClinicsWhere(),
    orderBy: { createdAt: "desc" },
    // The decision this screen exists for is "does this licence look real", so
    // the documents have to be on the same screen as the approve button.
    include: { documents: { orderBy: { kind: "asc" } } },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
          {t.admin.clinicsTitle}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {t.admin.clinicsSubtitle}
        </p>
      </header>

      {pending.length === 0 ? (
        <div className="border-border/60 bg-card rounded-2xl border px-6 py-16 text-center">
          <div className="bg-teal-deep/10 text-teal-deep mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full">
            <Building2 className="h-7 w-7" />
          </div>
          <p className="text-foreground mt-5 text-lg font-semibold">{t.admin.clinicsEmptyTitle}</p>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {t.admin.clinicsEmptyBody}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="border-coral/40 bg-coral/5 text-foreground rounded-2xl border px-5 py-3 text-sm">
            <strong className="font-semibold">{pending.length}</strong> {t.admin.clinicsPendingCount}
          </div>

          {pending.map((d) => (
            <article
              key={d.id}
              className="border-border/60 bg-card overflow-hidden rounded-3xl border"
            >
              <div className="border-border/60 flex flex-wrap items-start justify-between gap-4 border-b p-6">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="bg-teal-deep/10 text-teal-deep inline-flex h-11 w-11 items-center justify-center rounded-xl">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-display text-foreground text-xl font-bold">
                        {d.clinicName}
                        {d.isActive && (
                          <span className="bg-coral/15 text-coral ms-2 rounded-full px-2 py-0.5 text-[10px] font-semibold align-middle">
                            {t.admin.missingLicenceStamp}
                          </span>
                        )}
                      </h2>
                      <p className="text-muted-foreground text-sm">{d.dentistName}</p>
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  {format(t.admin.registeredOn, { date: dateFmt.format(d.createdAt) })}
                </p>
              </div>

              <div className="grid gap-x-8 gap-y-4 p-6 sm:grid-cols-2">
                <Detail icon={User} label={t.admin.contactPerson} value={d.contactName ?? "—"} />
                <Detail icon={Mail} label={t.admin.colEmail} value={d.email} />
                <Detail icon={Phone} label={t.admin.colPhone} value={d.phone} />
                <Detail
                  icon={MapPin}
                  label={t.admin.address}
                  value={`${d.address}${d.city ? `, ${d.city}` : ""}`}
                />
                <Detail icon={Clock} label={t.admin.experienceYears} value={format(t.admin.years, { count: d.experienceYears })} />
                <Detail
                  icon={Building2}
                  label={t.admin.colSpecialties}
                  value={d.specialties.map((s) => translateSpecialty(t.labels, s)).join(", ") || "—"}
                />
                <Detail
                  icon={Building2}
                  label={t.admin.treatments}
                  value={d.treatments.map((v) => translateTreatment(t.labels, v)).join(", ") || "—"}
                />
                <Detail
                  icon={Building2}
                  label={t.admin.colInsurers}
                  value={d.insurerAffiliations.map((i) => translateInsurer(t.labels, i)).join(", ") || "—"}
                />
              </div>

              <div className="border-border/60 border-t px-6 py-4">
                <p className="text-foreground inline-flex items-center gap-1.5 text-xs font-semibold">
                  <ShieldCheck className="text-teal-deep h-4 w-4" />
                  {t.admin.clinicDocs}
                </p>
                {d.documents.length === 0 ? (
                  // Registration cannot produce this any more, but a clinic
                  // created before the gate existed can — and approving one
                  // unseen is exactly what the promise forbids.
                  <p className="text-coral mt-1.5 text-sm">{t.admin.clinicDocsNone}</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {d.documents.map((doc) => (
                      <li key={doc.id} className="text-sm">
                        <a
                          href={`/api/clinics/documents/${doc.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-deep font-medium hover:underline"
                        >
                          {doc.kind}
                        </a>
                        <span className="text-muted-foreground ms-2 text-xs">
                          {dateFmt.format(doc.uploadedAt)}
                        </span>
                        {/* Without this there is no way to tell a document you
                            have already asked to have replaced from one you
                            have not looked at yet. */}
                        {doc.rejectedAt && (
                          <span className="text-coral ms-2 text-xs">
                            {format(t.admin.docRejectedOn, {
                              date: dateFmt.format(doc.rejectedAt),
                            })}
                            {doc.rejectionReason ? ` — ${doc.rejectionReason}` : ""}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-border/60 flex flex-wrap items-center justify-between gap-4 border-t px-6 py-4">
                <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                  <FileSignature className="text-teal-deep h-4 w-4" />
                  {d.agreedToTermsAt ? (
                    <>
                      {format(t.admin.contractSigned, { version: d.termsVersion ?? "—" })}
                      {dateFmt.format(d.agreedToTermsAt)}
                    </>
                  ) : (
                    <span className="text-coral">{t.admin.contractMissing}</span>
                  )}
                </p>
                <ClinicReviewActions
                  dentistId={d.id}
                  clinicName={d.clinicName}
                  isActive={d.isActive}
                />
              </div>

              <div className="border-border/60 border-t px-6 py-4">
                {d.documents.length > 0 && (
                  <RequestDocumentsForm
                    dentistId={d.id}
                    clinicName={d.clinicName}
                    documents={d.documents.map((doc) => ({ id: doc.id, kind: doc.kind }))}
                  />
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="text-muted-foreground/70 mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-foreground text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
