import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { formatMoney } from "@/lib/money";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.admin.metaSubscriptions };
}
export const dynamic = "force-dynamic";

const statusHe: Record<string, string> = {
  
};

const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", year: "numeric" });

export default async function AdminSubscriptionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  await requireAdmin();

  const subs = await db.clinicSubscription.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      plan: true,
      status: true,
      priceMinor: true,
      currency: true,
      currentPeriodEnd: true,
      dentist: { select: { clinicName: true, email: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">{t.admin.subscriptionsTitle}</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{t.admin.subscriptionsSubtitle}</p>
      </header>

      <div className="border-border/60 bg-card overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colClinic}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colPlan}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colStatus}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colValidUntil}</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {subs.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted-foreground px-4 py-8 text-center">
                  {t.admin.emptySubscriptions}
                </td>
              </tr>
            ) : (
              subs.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <p className="text-foreground font-medium">{s.dentist.clinicName}</p>
                    <p className="text-muted-foreground text-xs">{s.dentist.email}</p>
                  </td>
                  <td className="text-foreground px-4 py-3">
                    {(s.plan === "MONTHLY" ? t.emails.planMonthly : t.emails.planYearly)} ·{" "}
                    {formatMoney(s.priceMinor ?? 0, s.currency ?? "ILS", "he")}
                  </td>
                  <td className="px-4 py-3">{statusHe[s.status]}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {s.currentPeriodEnd ? dateFmt.format(s.currentPeriodEnd) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
