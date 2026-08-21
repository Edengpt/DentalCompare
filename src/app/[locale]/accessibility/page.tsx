import { notFound } from "next/navigation";
import { LegalLayout } from "@/components/legal/legal-layout";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale } from "@/i18n/config";
import AccessibilityContentHe, { accessibilityTitleHe } from "./content.he";
import AccessibilityContentEn, { accessibilityTitleEn } from "./content.en";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);
  return { title: t.footer.accessibility };
}

export default async function AccessibilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);

  const isHebrew = locale === "he";

  return (
    <LegalLayout
      title={isHebrew ? accessibilityTitleHe : accessibilityTitleEn}
      updated={t.legal.lastUpdated}
    >
      {isHebrew ? <AccessibilityContentHe /> : <AccessibilityContentEn />}
    </LegalLayout>
  );
}
