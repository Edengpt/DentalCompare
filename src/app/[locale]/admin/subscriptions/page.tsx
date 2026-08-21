import { formatMoney } from "@/lib/money";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";

export const metadata = { title: "ניהול — מנויים" };
export const dynamic = "force-dynamic";

const statusHe: Record<string, string> = {
  PENDING: "ממתין לתשלום",
  ACTIVE: "פעיל",
  PAST_DUE: "חיוב נכשל",
  CANCELED: "בוטל",
};

const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", year: "numeric" });

export default async function AdminSubscriptionsPage() {
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
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">מנויים</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">מצב המנויים של המרפאות בפלטפורמה.</p>
      </header>

      <div className="border-border/60 bg-card overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="px-4 py-3 text-start font-medium">מרפאה</th>
              <th className="px-4 py-3 text-start font-medium">מסלול</th>
              <th className="px-4 py-3 text-start font-medium">סטטוס</th>
              <th className="px-4 py-3 text-start font-medium">תוקף עד</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {subs.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted-foreground px-4 py-8 text-center">
                  אין מנויים עדיין.
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
                    {SUBSCRIPTION_PLANS[s.plan as "MONTHLY" | "YEARLY"].labelHe} ·{" "}
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
