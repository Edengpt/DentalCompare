import { notFound } from "next/navigation";
import { LegalLayout } from "@/components/legal/legal-layout";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale } from "@/i18n/config";
import DisclaimerContentHe, { disclaimerTitleHe } from "./content.he";
import DisclaimerContentEn, { disclaimerTitleEn } from "./content.en";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);
  return { title: t.footer.medicalDisclaimer };
}

export default async function DisclaimerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);

  const isHebrew = locale === "he";

  return (
    <LegalLayout
      title={isHebrew ? disclaimerTitleHe : disclaimerTitleEn}
      updated={t.legal.lastUpdated}
    >
      {isHebrew ? <DisclaimerContentHe /> : <DisclaimerContentEn />}
    </LegalLayout>
  );
}
