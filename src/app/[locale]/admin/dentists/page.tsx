import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";
import { translateSpecialty, translateInsurer, translateLanguage } from "@/lib/labels";
import { ToggleActive } from "@/components/admin/toggle-active";
import { NewDentistForm } from "@/components/admin/new-dentist-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.admin.metaDentists };
}
export const dynamic = "force-dynamic";

export default async function AdminDentistsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  await requireAdmin();

  const dentists = await db.dentist.findMany({
    // Pending self-registrations (inactive, self-submitted) bubble to the top.
    orderBy: [{ isActive: "asc" }, { submittedBySelf: "desc" }, { createdAt: "desc" }],
  });

  const pendingCount = dentists.filter((d) => d.submittedBySelf && !d.isActive).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
            {t.admin.dentistsTitle}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {format(t.admin.dentistsSubtitle, { count: dentists.length })}
          </p>
        </div>
        <NewDentistForm />
      </header>

      {pendingCount > 0 && (
        <div className="border-coral/40 bg-coral/5 text-foreground rounded-2xl border px-5 py-3 text-sm">
          <strong className="font-semibold">{pendingCount}</strong> {t.admin.dentistsPendingNotice}
        </div>
      )}

      <div className="border-border/60 bg-card overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colDentist}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colCity}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colSpecialties}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colInsurers}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colLanguages}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colExperience}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colStatus}</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {dentists.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted-foreground px-4 py-8 text-center">
                  {t.admin.emptyDentists}
                </td>
              </tr>
            ) : (
              dentists.map((d) => {
                const pending = d.submittedBySelf && !d.isActive;
                return (
                  <tr key={d.id} className={pending ? "bg-coral/5" : undefined}>
                    <td className="px-4 py-3">
                      <p className="text-foreground flex items-center gap-2 font-medium">
                        {d.dentistName}
                        {pending && (
                          <span className="bg-coral/15 text-coral rounded-full px-2 py-0.5 text-[10px] font-semibold">
                            {t.admin.newRegistration}
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {d.clinicName} ✦ {d.email}
                      </p>
                      {d.submittedBySelf && d.contactName && (
                        <p className="text-muted-foreground/80 mt-0.5 text-xs">
                          {t.admin.contactPerson}: {d.contactName}
                          {d.agreedToTermsAt && t.admin.signedContract}
                        </p>
                      )}
                    </td>
                    <td className="text-foreground px-4 py-3">{d.city}</td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {d.specialties.map((s) => translateSpecialty(t.labels, s)).join(", ") || "—"}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {d.insurerAffiliations.map((i) => translateInsurer(t.labels, i)).join(", ") ||
                        "—"}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {d.spokenLanguages.map((l) => translateLanguage(t.labels, l)).join(", ") ||
                        "—"}
                    </td>
                    <td className="text-foreground px-4 py-3">
                      {format(t.admin.years, { count: d.experienceYears })}
                    </td>
                    <td className="px-4 py-3">
                      <ToggleActive dentistId={d.id} isActive={d.isActive} pending={pending} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
