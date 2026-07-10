import Link from "next/link";
import { Users, Stethoscope, FileText, Banknote, Building2, ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";

export const metadata = { title: "ניהול — סקירה" };
export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  PENDING: "ממתין",
  PAID: "שולם",
  FAILED: "נכשל",
};

export default async function AdminOverviewPage() {
  const [
    totalUsers,
    totalDentists,
    totalRequests,
    paidAgg,
    requestsByStatus,
    recentRequests,
    pendingClinics,
  ] = await Promise.all([
      db.user.count(),
      db.dentist.count(),
      db.request.count(),
      db.payment.aggregate({ where: { status: "PAID" }, _sum: { amountAgorot: true } }),
      db.request.groupBy({ by: ["status"], _count: { _all: true } }),
      db.request.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          status: true,
          createdAt: true,
          user: { select: { fullName: true, email: true } },
          _count: { select: { requestDentists: true } },
        },
      }),
      db.dentist.count({ where: { submittedBySelf: true, isActive: false } }),
    ]);

  // Amounts are stored in agorot (int); convert back to shekels for display.
  const totalRevenue = (paidAgg._sum.amountAgorot ?? 0) / 100;

  const stats = [
    { label: "סה״כ משתמשים", value: totalUsers.toLocaleString("he-IL"), icon: Users },
    { label: "סה״כ רופאים", value: totalDentists.toLocaleString("he-IL"), icon: Stethoscope },
    { label: "סה״כ בקשות", value: totalRequests.toLocaleString("he-IL"), icon: FileText },
    {
      label: "סה״כ הכנסות",
      value: `${totalRevenue.toLocaleString("he-IL")} ₪`,
      icon: Banknote,
    },
  ];

  const countFor = (status: string) =>
    requestsByStatus.find((r) => r.status === status)?._count._all ?? 0;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">סקירה</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">תמונת מצב כללית של הפלטפורמה.</p>
      </header>

      {pendingClinics > 0 && (
        <Link
          href="/admin/clinics"
          className="border-coral/40 bg-coral/5 hover:bg-coral/10 group flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="bg-coral/15 text-coral inline-flex h-10 w-10 items-center justify-center rounded-xl">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-foreground text-sm font-semibold">
                {pendingClinics} הרשמות מרפאות ממתינות לאישור
              </p>
              <p className="text-muted-foreground text-xs">לחצו לבדיקה ואישור הרשמות חדשות.</p>
            </div>
          </div>
          <ArrowLeft className="text-coral h-4 w-4 transition-transform group-hover:-translate-x-1" />
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="border-border/60 bg-card rounded-2xl border p-5">
            <div className="bg-teal-deep/10 text-teal-deep inline-flex h-10 w-10 items-center justify-center rounded-xl">
              <s.icon className="h-5 w-5" />
            </div>
            <p className="text-foreground mt-4 text-3xl font-bold tracking-tight">{s.value}</p>
            <p className="text-muted-foreground mt-1 text-sm">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["PENDING", "PAID", "FAILED"] as const).map((status) => (
          <div
            key={status}
            className="border-border/60 bg-card flex items-center justify-between rounded-2xl border px-5 py-4"
          >
            <span className="text-muted-foreground text-sm">בקשות — {statusLabels[status]}</span>
            <span className="text-foreground text-lg font-bold">{countFor(status)}</span>
          </div>
        ))}
      </div>

      <section>
        <h2 className="font-display text-foreground mb-3 text-lg font-bold">בקשות אחרונות</h2>
        <div className="border-border/60 bg-card overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="px-4 py-3 text-start font-medium">מטופל</th>
                <th className="px-4 py-3 text-start font-medium">רופאים</th>
                <th className="px-4 py-3 text-start font-medium">סטטוס</th>
                <th className="px-4 py-3 text-start font-medium">תאריך</th>
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {recentRequests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted-foreground px-4 py-8 text-center">
                    אין בקשות עדיין.
                  </td>
                </tr>
              ) : (
                recentRequests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <p className="text-foreground font-medium">
                        {r.user?.fullName ?? "משתמש שנמחק"}
                      </p>
                      <p className="text-muted-foreground text-xs">{r.user?.email ?? "—"}</p>
                    </td>
                    <td className="text-foreground px-4 py-3">{r._count.requestDentists}</td>
                    <td className="px-4 py-3">{statusLabels[r.status]}</td>
                    <td className="text-muted-foreground px-4 py-3">
                      {new Intl.DateTimeFormat("he-IL", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(r.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
