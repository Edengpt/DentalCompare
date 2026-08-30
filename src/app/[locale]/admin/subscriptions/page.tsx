import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { formatMoney } from "@/lib/money";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.admin.metaSubscriptions };
}
export const dynamic = "force-dynamic";

// Was a local Hebrew-only map, left empty by the move to two languages — so the
// status column rendered blank for every row in both languages, silently. The
// labels live in the dictionary now, like every other string on the site.
/** The date this subscription is paid up to — the trial's end while it lasts. */
function validUntil(s: { currentPeriodEnd: Date | null; trialEndsAt: Date | null }): Date | null {
  return s.currentPeriodEnd ?? s.trialEndsAt;
}

function statusLabel(status: string, t: Dictionary["admin"]): string {
  switch (status) {
    case "PENDING":
      return t.subPending;
    case "TRIALING":
      return t.subTrialing;
    case "ACTIVE":
      return t.subActive;
    case "PAST_DUE":
      return t.subPastDue;
    case "CANCELED":
      return t.subCanceled;
    default:
      return status;
  }
}

export default async function AdminSubscriptionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  await requireAdmin();

  // Was pinned to he/he-IL, so an admin reading the English site got Hebrew
  // dates and Hebrew number grouping.
  const pageLocale = isLocale(locale) ? locale : defaultLocale;
  const dateFmt = new Intl.DateTimeFormat(pageLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const subs = await db.clinicSubscription.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      plan: true,
      status: true,
      priceMinor: true,
      currency: true,
      currentPeriodEnd: true,
      // A trialing subscription has no currentPeriodEnd — its clock is
      // trialEndsAt, and showing "—" for every trial hid exactly the date this
      // screen exists to watch.
      trialEndsAt: true,
      trialEndedUnbilledAt: true,
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
                    {formatMoney(s.priceMinor ?? 0, s.currency ?? "ILS", pageLocale)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-foreground">{statusLabel(s.status, t.admin)}</p>
                    {s.trialEndedUnbilledAt && (
                      <p
                        className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                        title={t.admin.subTrialUnbilledHint}
                      >
                        {t.admin.subTrialUnbilled}
                      </p>
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {validUntil(s) ? dateFmt.format(validUntil(s)!) : "—"}
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
