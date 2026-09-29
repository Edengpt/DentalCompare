import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { StepHeader } from "@/components/request/step-header";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { UploadStep } from "@/components/upload/upload-step";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.requestFlow.uploadMetaTitle };
}

export const dynamic = "force-dynamic";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const user = await db.user.findUnique({ where: { clerkUserId } });
  if (!user) redirect("/sign-in");

  const request = await db.request.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      treatmentFileUrl: true,
      xrayFileUrl: true,
      consentAt: true,
      status: true,
    },
  });

  if (!request || request.userId !== user.id) notFound();

  return (
    <>
      <Header />
      <main className="flex-1">
        <StepHeader
          step={1}
          label={t.requestFlow.uploadStep}
          title={t.requestFlow.uploadTitle}
          subtitle={t.requestFlow.uploadSubtitle}
        />

        <div className="mx-auto max-w-3xl px-6 py-6 sm:py-10 lg:px-10 lg:py-14">
          <UploadStep
            requestId={request.id}
            initialTreatmentUrl={request.treatmentFileUrl || null}
            initialXrayUrl={request.xrayFileUrl || null}
            initialConsented={Boolean(request.consentAt)}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
