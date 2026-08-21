import { notFound } from "next/navigation";
import { LegalLayout } from "@/components/legal/legal-layout";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale } from "@/i18n/config";
import PrivacyContentHe, { privacyTitleHe } from "./content.he";
import PrivacyContentEn, { privacyTitleEn } from "./content.en";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);
  return { title: t.footer.privacy };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);

  const isHebrew = locale === "he";

  return (
    <LegalLayout title={isHebrew ? privacyTitleHe : privacyTitleEn} updated={t.legal.lastUpdated}>
      {isHebrew ? <PrivacyContentHe /> : <PrivacyContentEn />}
    </LegalLayout>
  );
}
