import Link from "next/link";
import {
  LayoutGrid,
  Stethoscope,
  Building2,
  Users,
  FileText,
  CreditCard,
  Repeat,
  ArrowLeft,
} from "lucide-react";
import { requireAdmin } from "@/server/admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "סקירה", icon: LayoutGrid },
  { href: "/admin/clinics", label: "הרשמות מרפאות", icon: Building2, badgeKey: "pendingClinics" },
  { href: "/admin/dentists", label: "רופאים", icon: Stethoscope },
  { href: "/admin/users", label: "משתמשים", icon: Users },
  { href: "/admin/requests", label: "בקשות", icon: FileText },
  { href: "/admin/payments", label: "תשלומים", icon: CreditCard },
  { href: "/admin/subscriptions", label: "מנויים", icon: Repeat },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  const pendingClinics = await db.dentist.count({
    where: { submittedBySelf: true, isActive: false },
  });
  const badges: Record<string, number> = { pendingClinics };

  return (
    <div className="bg-muted/20 flex min-h-screen flex-col lg:flex-row">
      <aside className="border-border/60 bg-card shrink-0 border-b lg:w-64 lg:border-e lg:border-b-0">
        <div className="flex h-full flex-col p-5 lg:p-6">
          <Link href="/" className="font-display text-teal-deep text-xl font-bold">
            DentalCompare
          </Link>
          <p className="text-muted-foreground mt-1 text-xs">פאנל ניהול</p>

          <nav className="mt-6 flex flex-row gap-1 overflow-x-auto lg:mt-8 lg:flex-col">
            {NAV.map((item) => {
              const badge = "badgeKey" in item ? badges[item.badgeKey] : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-foreground hover:bg-teal-deep/8 hover:text-teal-deep inline-flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {badge > 0 && (
                    <span className="bg-coral text-cream ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground mt-auto hidden items-center gap-1.5 pt-6 text-xs lg:inline-flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            חזרה לאזור האישי
          </Link>
        </div>
      </aside>

      <main className="flex-1 px-5 py-8 lg:px-10 lg:py-12">{children}</main>
    </div>
  );
}
