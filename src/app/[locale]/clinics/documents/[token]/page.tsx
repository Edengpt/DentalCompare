import { notFound } from "next/navigation";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { getClinicByDocumentToken } from "@/server/clinic-documents";
import { ReplaceDocumentsForm } from "@/components/clinics/replace-documents-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.clinics.replaceTitle, robots: { index: false, follow: false } };
}

/**
 * Where a clinic replaces a refused document. Public by design: the clinic has
 * no account, so requiring a sign-in would be a dead end rather than a gate.
 *
 * A dead or unknown token is a 404 rather than a message naming the clinic —
 * the page is reachable by anyone who has the URL.
 */
export default async function ReplaceDocumentsPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);

  const clinic = await getClinicByDocumentToken(token);
  if (!clinic) notFound();

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
          {t.clinics.replaceTitle}
        </h1>
        <p className="text-muted-foreground mt-3">{t.clinics.replaceIntro}</p>
        {clinic.documents.length === 0 ? (
          // The link is live but every document has already been replaced —
          // saying "nothing to do" beats an empty page that looks broken.
          <p className="text-teal-deep mt-8">{t.clinics.replaceNothing}</p>
        ) : (
          <ReplaceDocumentsForm token={token} documents={clinic.documents} />
        )}
      </main>
      <Footer />
    </>
  );
}
