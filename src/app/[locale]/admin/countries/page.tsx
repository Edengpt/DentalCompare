import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale, localeNames, asLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/admin";
import { NewCountryForm } from "@/components/admin/country-form";
import { ToggleCountry } from "@/components/admin/toggle-country";
import { SeedPopularCountries } from "@/components/admin/seed-popular-countries";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.admin.metaCountries };
}
export const dynamic = "force-dynamic";

export default async function AdminCountriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  await requireAdmin();

  const countries = await db.country.findMany({
    // Drafts first: a country sitting unconfigured is the row that needs work.
    orderBy: [{ isActive: "asc" }, { nameEn: "asc" }],
    include: { _count: { select: { dentists: true } } },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
            {t.admin.countriesTitle}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {format(t.admin.countriesSubtitle, { count: countries.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SeedPopularCountries />
          <NewCountryForm />
        </div>
      </header>

      <div className="border-border/60 bg-card overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colCode}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colCountry}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colCurrency}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colCallingCode}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colDefaultLocale}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colInsurers}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colRequiredDocs}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colClinics}</th>
              <th className="px-4 py-3 text-start font-medium">{t.admin.colStatus}</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {countries.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-muted-foreground px-4 py-8 text-center">
                  {t.admin.emptyCountries}
                </td>
              </tr>
            ) : (
              countries.map((c) => (
                <tr key={c.code} className={c.isActive ? undefined : "bg-coral/5"}>
                  <td className="text-foreground px-4 py-3 font-mono font-medium">{c.code}</td>
                  <td className="text-foreground px-4 py-3 font-medium">{c.nameEn}</td>
                  <td className="text-foreground px-4 py-3 font-mono">{c.currency}</td>
                  <td className="text-foreground px-4 py-3 font-mono">+{c.callingCode}</td>
                  <td className="text-foreground px-4 py-3">
                    {localeNames[asLocale(c.defaultLocale)]}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {c.insurers.join(", ") || "—"}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {c.requiredDocs.join(", ") || "—"}
                  </td>
                  <td className="text-foreground px-4 py-3">{c._count.dentists}</td>
                  <td className="px-4 py-3">
                    <ToggleCountry code={c.code} name={c.nameEn} isActive={c.isActive} />
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
