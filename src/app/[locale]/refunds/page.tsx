import { notFound } from "next/navigation";
import { LegalLayout } from "@/components/legal/legal-layout";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale } from "@/i18n/config";
import RefundsContentHe, { refundsTitleHe } from "./content.he";
import RefundsContentEn, { refundsTitleEn } from "./content.en";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);
  return { title: t.footer.refunds };
}

export default async function RefundsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getDictionary(locale);

  const isHebrew = locale === "he";

  return (
    <LegalLayout title={isHebrew ? refundsTitleHe : refundsTitleEn} updated={t.legal.lastUpdated}>
      {isHebrew ? <RefundsContentHe /> : <RefundsContentEn />}
    </LegalLayout>
  );
}
