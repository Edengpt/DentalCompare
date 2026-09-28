import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { LocaleLink as Link } from "@/i18n/locale-link";
import { Building2 } from "lucide-react";
import { requireAdmin } from "@/server/admin";
import { db } from "@/lib/db";
import { pendingClinicsWhere } from "@/lib/clinic-approval";
import { adminReviewStage } from "@/lib/clinic-review-stage";
import { StatusBadge } from "@/components/request/status-badge";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.admin.metaClinics };
}
export const dynamic = "force-dynamic";

/**
 * The review queue: one dense row per pending clinic, what needs the admin
 * first. The decision itself — with the documents on screen beside the
 * approve button — happens on each clinic's review page.
 */
export default async function AdminClinicsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getDictionary(locale);
  await requireAdmin();

  const pending = await db.dentist.findMany({
    where: pendingClinicsWhere(),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      clinicName: true,
      dentistName: true,
      city: true,
      countryCode: true,
      isActive: true,
      createdAt: true,
      documents: { select: { rejectedAt: true } },
    },
  });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const rows = pending
    .map((d) => ({ ...d, ...adminReviewStage(d) }))
    // What the admin can act on first, then what waits on the clinic.
    .sort((a, b) => Number(b.tone !== "waiting") - Number(a.tone !== "waiting"));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
          {t.admin.clinicsTitle}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{t.admin.clinicsSubtitle}</p>
      </header>

      {rows.length === 0 ? (
        <div className="border-border/60 bg-card rounded-lg border px-6 py-16 text-center">
          <div className="bg-teal-deep/10 text-teal-deep mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full">
            <Building2 className="h-7 w-7" />
          </div>
          <p className="text-foreground mt-5 text-lg font-semibold">{t.admin.clinicsEmptyTitle}</p>
          <p className="text-muted-foreground mt-1.5 text-sm">{t.admin.clinicsEmptyBody}</p>
        </div>
      ) : (
        <div className="border-border/60 bg-card overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">{t.admin.colClinic}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t.admin.colLocation}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t.admin.colRegistered}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t.admin.colDocs}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t.admin.colStatus}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {rows.map((d) => {
                const returned = d.documents.filter((doc) => doc.rejectedAt).length;
                return (
                  <tr key={d.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <p className="text-foreground font-semibold">{d.clinicName}</p>
                      <p className="text-muted-foreground text-xs">{d.dentistName}</p>
                    </td>
                    <td className="text-muted-foreground px-4 py-2.5">
                      {d.countryCode} ✦ {d.city}
                    </td>
                    <td className="text-muted-foreground px-4 py-2.5 whitespace-nowrap">
                      {dateFmt.format(d.createdAt)}
                    </td>
                    <td className="text-muted-foreground px-4 py-2.5">
                      {d.documents.length}
                      {returned > 0 && (
                        <span className="text-alert ms-1 text-xs">
                          ({format(t.admin.docsReturned, { count: returned })})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge tone={d.tone}>{t.admin.reviewStage[d.stage]}</StatusBadge>
                    </td>
                    <td className="px-4 py-2.5 text-end">
                      <Link
                        href={`/admin/clinics/${d.id}`}
                        className="text-teal-deep text-sm font-semibold whitespace-nowrap underline-offset-4 hover:underline"
                      >
                        {t.admin.review}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
