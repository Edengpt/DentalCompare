import { notFound } from "next/navigation";
import { LegalLayout } from "@/components/legal/legal-layout";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale } from "@/i18n/config";
import TermsContentHe, { termsTitleHe } from "./content.he";
import TermsContentEn, { termsTitleEn } from "./content.en";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);
  return { title: t.footer.terms };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);

  const isHebrew = locale === "he";

  return (
    <LegalLayout title={isHebrew ? termsTitleHe : termsTitleEn} updated={t.legal.lastUpdated}>
      {isHebrew ? <TermsContentHe /> : <TermsContentEn />}
    </LegalLayout>
  );
}
