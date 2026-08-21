import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { Building2, Mail, Phone, MapPin, Clock, FileSignature, User } from "lucide-react";
import { requireAdmin } from "@/server/admin";
import { db } from "@/lib/db";
import { translateSpecialty, translateInsurer, translateTreatment } from "@/lib/labels";
import { ClinicReviewActions } from "@/components/admin/clinic-review-actions";

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
    where: { submittedBySelf: true, isActive: false },
    orderBy: { createdAt: "desc" },
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
                <ClinicReviewActions dentistId={d.id} clinicName={d.clinicName} />
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
