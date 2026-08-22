import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.admin.metaUsers };
}
export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  await requireAdmin();

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      createdAt: true,
      _count: { select: { requests: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
          {t.admin.usersTitle}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {format(t.admin.usersSubtitle, { count: users.length })}
        </p>
      </header>

      <div className="border-border/60 bg-card overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colName}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colEmail}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colPhone}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colRequests}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colJoined}</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-4 py-8 text-center">
                  {t.admin.emptyUsers}
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="text-foreground px-4 py-3 font-medium">{u.fullName ?? "—"}</td>
                  <td className="text-muted-foreground px-4 py-3">{u.email}</td>
                  <td className="text-muted-foreground px-4 py-3">{u.phone || "—"}</td>
                  <td className="text-foreground px-4 py-3">{u._count.requests}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {new Intl.DateTimeFormat("he-IL", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(u.createdAt)}
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
