import { notFound } from "next/navigation";
import { LegalLayout } from "@/components/legal/legal-layout";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale } from "@/i18n/config";
import ClinicAgreementContentHe, { clinicAgreementTitleHe } from "./content.he";
import ClinicAgreementContentEn, { clinicAgreementTitleEn } from "./content.en";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);
  return { title: t.footer.clinicAgreement };
}

export default async function ClinicAgreementPage({
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
      title={isHebrew ? clinicAgreementTitleHe : clinicAgreementTitleEn}
      updated={t.legal.lastUpdated}
    >
      {isHebrew ? <ClinicAgreementContentHe /> : <ClinicAgreementContentEn />}
    </LegalLayout>
  );
}
