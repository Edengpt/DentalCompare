import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
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
        <section className="border-border/60 bg-muted/30 border-b py-12 lg:py-16">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <p className="eyebrow">{t.requestFlow.uploadStep}</p>
            <h1 className="font-display text-foreground mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              {t.requestFlow.uploadTitle}
            </h1>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              {t.requestFlow.uploadSubtitle}
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10 lg:py-14">
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
