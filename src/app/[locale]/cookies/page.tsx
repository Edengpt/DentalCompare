import { notFound } from "next/navigation";
import { LegalLayout } from "@/components/legal/legal-layout";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale } from "@/i18n/config";
import CookiesContentHe, { cookiesTitleHe } from "./content.he";
import CookiesContentEn, { cookiesTitleEn } from "./content.en";

/**
 * Legal pages keep one content component per language rather than pulling their
 * prose into the shared dictionary.
 *
 * These are long-form documents with structure inside them — emphasis, lists,
 * inline placeholders for details only the operator can supply. Flattening that
 * into dictionary strings would either strip the markup or bury it in escaped
 * fragments, and it would bloat a dictionary that exists for interface labels.
 * Side-by-side files also make the two versions reviewable against each other,
 * which is what a legal text actually needs.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);
  return { title: t.footer.cookies };
}

export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);

  const isHebrew = locale === "he";

  return (
    <LegalLayout title={isHebrew ? cookiesTitleHe : cookiesTitleEn} updated={t.legal.lastUpdated}>
      {isHebrew ? <CookiesContentHe /> : <CookiesContentEn />}
    </LegalLayout>
  );
}
