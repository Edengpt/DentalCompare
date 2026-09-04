import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { LocaleLink as Link } from "@/i18n/locale-link";
import { LayoutGrid, Stethoscope, Building2, Users, FileText, Repeat, Globe } from "lucide-react";
import { ForwardArrow } from "@/components/ui/forward-arrow";
import { requireAdmin } from "@/server/admin";
import { db } from "@/lib/db";
import { needsOperatorAttentionWhere } from "@/lib/subscription-alerts";
import { pendingClinicsWhere } from "@/lib/clinic-approval";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  await requireAdmin();

  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);

  const NAV = [
    { href: "/admin", label: t.admin.navOverview, icon: LayoutGrid },
    {
      href: "/admin/clinics",
      label: t.admin.navClinics,
      icon: Building2,
      badgeKey: "pendingClinics",
    },
    { href: "/admin/dentists", label: t.admin.navDentists, icon: Stethoscope },
    { href: "/admin/users", label: t.admin.navUsers, icon: Users },
    { href: "/admin/requests", label: t.admin.navRequests, icon: FileText },
    {
      href: "/admin/subscriptions",
      label: t.admin.navSubscriptions,
      icon: Repeat,
      badgeKey: "subsNeedingAttention",
    },
    { href: "/admin/countries", label: t.admin.navCountries, icon: Globe },
  ] as const;

  // A trial that ended unbilled is stuck until a person acts, and until now the
  // only way to learn about it was to browse to the subscriptions screen and
  // notice a chip on a row. The badge is the second channel beside the email,
  // and unlike the email it needs no configuration to work.
  const [pendingClinics, subsNeedingAttention] = await Promise.all([
    db.dentist.count({ where: pendingClinicsWhere() }),
    db.clinicSubscription.count({ where: needsOperatorAttentionWhere() }),
  ]);
  const badges: Record<string, number> = { pendingClinics, subsNeedingAttention };

  return (
    <div className="bg-muted/20 flex min-h-screen flex-col lg:flex-row">
      <aside className="border-border/60 bg-card shrink-0 border-b lg:w-64 lg:border-e lg:border-b-0">
        <div className="flex h-full flex-col p-5 lg:p-6">
          <Link href="/" className="font-display text-teal-deep text-xl font-bold">
            DentalCompare
          </Link>
          <p className="text-muted-foreground mt-1 text-xs">{t.admin.panel}</p>

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
            <ForwardArrow className="h-3.5 w-3.5" />
            {t.admin.backToDashboard}
          </Link>
        </div>
      </aside>

      <main className="flex-1 px-5 py-8 lg:px-10 lg:py-12">{children}</main>
    </div>
  );
}
