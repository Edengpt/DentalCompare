import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.admin.metaRequests };
}
export const dynamic = "force-dynamic";

export default async function AdminRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
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
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
          {t.admin.requestsTitle}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {format(t.admin.requestsSubtitle, { count: requests.length })}
        </p>
      </header>

      <div className="border-border/60 bg-card overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colRequest}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colPatient}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colDentists}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colSent}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colFiles}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colStatus}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colDate}</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted-foreground px-4 py-8 text-center">
                  {t.admin.emptyRequests}
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
                        {r.user ? (r.user.fullName ?? "—") : t.admin.deletedUser}
                      </p>
                      <p className="text-muted-foreground text-xs">{r.user?.email ?? "—"}</p>
                    </td>
                    <td className="text-foreground px-4 py-3">{r._count.requestDentists}</td>
                    <td className="text-foreground px-4 py-3">{r.requestDentists.length}</td>
                    <td className="px-4 py-3">{filesReady ? "✓" : "—"}</td>
                    <td className="px-4 py-3">{t.requestStatus[r.status]}</td>
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
