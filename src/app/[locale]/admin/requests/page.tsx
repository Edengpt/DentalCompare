import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";
import { REQUEST_STATUS_LABELS_HE } from "@/lib/labels";

export const metadata = { title: "ניהול — בקשות" };
export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  await requireAdmin();

  const requests = await db.request.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      treatmentFileUrl: true,
      xrayFileUrl: true,
      user: { select: { fullName: true, email: true } },
      _count: { select: { requestDentists: true } },
      requestDentists: { where: { emailSent: true }, select: { id: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">בקשות</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{requests.length} בקשות סה״כ.</p>
      </header>

      <div className="border-border/60 bg-card overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="px-4 py-3 text-start font-medium">בקשה</th>
              <th className="px-4 py-3 text-start font-medium">מטופל</th>
              <th className="px-4 py-3 text-start font-medium">רופאים</th>
              <th className="px-4 py-3 text-start font-medium">נשלחו</th>
              <th className="px-4 py-3 text-start font-medium">קבצים</th>
              <th className="px-4 py-3 text-start font-medium">סטטוס</th>
              <th className="px-4 py-3 text-start font-medium">תאריך</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted-foreground px-4 py-8 text-center">
                  אין בקשות עדיין.
                </td>
              </tr>
            ) : (
              requests.map((r) => {
                const filesReady = !!r.treatmentFileUrl && !!r.xrayFileUrl;
                return (
                  <tr key={r.id}>
                    <td className="text-foreground px-4 py-3 font-mono text-xs">
                      {r.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground font-medium">
                        {r.user?.fullName ?? "משתמש שנמחק"}
                      </p>
                      <p className="text-muted-foreground text-xs">{r.user?.email ?? "—"}</p>
                    </td>
                    <td className="text-foreground px-4 py-3">{r._count.requestDentists}</td>
                    <td className="text-foreground px-4 py-3">{r.requestDentists.length}</td>
                    <td className="px-4 py-3">{filesReady ? "✓" : "—"}</td>
                    <td className="px-4 py-3">{REQUEST_STATUS_LABELS_HE[r.status]}</td>
                    <td className="text-muted-foreground px-4 py-3">
                      {new Intl.DateTimeFormat("he-IL", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(r.createdAt)}
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
