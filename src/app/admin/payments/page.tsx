import { db } from "@/lib/db";

export const metadata = { title: "ניהול — תשלומים" };
export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  PENDING: "ממתין",
  PAID: "שולם",
  FAILED: "נכשל",
};

export default async function AdminPaymentsPage() {
  const [payments, paidAgg] = await Promise.all([
    db.payment.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        status: true,
        stripeSessionId: true,
        createdAt: true,
        user: { select: { fullName: true, email: true } },
      },
    }),
    db.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
  ]);

  const totalRevenue = paidAgg._sum.amount ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
            תשלומים
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">{payments.length} תשלומים סה״כ.</p>
        </div>
        <div className="border-border/60 bg-card rounded-2xl border px-5 py-3 text-end">
          <p className="text-muted-foreground text-xs">סה״כ הכנסות</p>
          <p className="text-foreground text-xl font-bold">
            {totalRevenue.toLocaleString("he-IL")} ₪
          </p>
        </div>
      </header>

      <div className="border-border/60 bg-card overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="px-4 py-3 text-start font-medium">מטופל</th>
              <th className="px-4 py-3 text-start font-medium">סכום</th>
              <th className="px-4 py-3 text-start font-medium">סטטוס</th>
              <th className="px-4 py-3 text-start font-medium">Session</th>
              <th className="px-4 py-3 text-start font-medium">תאריך</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-4 py-8 text-center">
                  אין תשלומים עדיין.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <p className="text-foreground font-medium">{p.user.fullName}</p>
                    <p className="text-muted-foreground text-xs">{p.user.email}</p>
                  </td>
                  <td className="text-foreground px-4 py-3 font-semibold">
                    {p.amount.toLocaleString("he-IL")} ₪
                  </td>
                  <td className="px-4 py-3">{statusLabels[p.status]}</td>
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                    {p.stripeSessionId.slice(0, 18)}…
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {new Intl.DateTimeFormat("he-IL", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(p.createdAt)}
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
