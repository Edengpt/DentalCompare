import { LocaleLink as Link } from "@/i18n/locale-link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, FileText, Image as ImageIcon, Users } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { plural } from "@/i18n/format";
import { SubmitButton } from "@/components/request/submit-button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.confirm.metaTitle };
}

export const dynamic = "force-dynamic";

export default async function ConfirmRequestPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id, locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true, phone: true, phoneVerifiedAt: true },
  });
  if (!user) redirect("/sign-in");

  const request = await db.request.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      createdAt: true,
      treatmentFileUrl: true,
      xrayFileUrl: true,
      requestDentists: {
        select: {
          dentist: { select: { id: true, dentistName: true, clinicName: true, city: true } },
        },
      },
    },
  });

  if (!request || request.userId !== user.id) notFound();

  // Already sent → the request is locked; send the user to the receipt.
  if (request.status === "SENT" || request.status === "SUBMITTED") {
    redirect(`/request/${id}/success`);
  }

  const filesReady = !!request.treatmentFileUrl && !!request.xrayFileUrl;
  if (!filesReady) redirect(`/request/${id}/upload`);

  const dentists = request.requestDentists.map((rd) => rd.dentist);
  if (dentists.length === 0) redirect(`/request/${id}/dentists`);

  const date = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(request.createdAt);

  // Sent requests are redirected above, so only DRAFT/FAILED reach here.
  const statusLabel =
    request.status === "FAILED" ? t.confirm.statusFailed : t.confirm.statusReady;

  const summaryRows = [
    {
      icon: Users,
      label: t.confirm.selectedDentists,
      value: plural(t.confirm.dentistsCount, dentists.length),
    },
    { icon: FileText, label: t.confirm.treatmentPlan, value: t.confirm.uploadedFeminine },
    { icon: ImageIcon, label: t.confirm.xray, value: t.confirm.uploadedMasculine },
    { icon: CheckCircle2, label: t.confirm.status, value: statusLabel },
  ];

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-border/60 bg-muted/30 border-b py-12 lg:py-16">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <p className="eyebrow">{t.confirm.step}</p>
            <h1 className="font-display text-foreground mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              {t.confirm.title}
            </h1>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              {t.confirm.subtitle}
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl space-y-8 px-6 py-10 lg:px-10 lg:py-14">
          {/* Summary card */}
          <div className="border-border/60 bg-card rounded-lg border p-6 sm:p-8">
            <dl className="divide-border/60 divide-y">
              {summaryRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <dt className="text-muted-foreground inline-flex items-center gap-2 text-sm">
                    <row.icon className="text-teal-deep h-4 w-4" />
                    {row.label}
                  </dt>
                  <dd className="text-foreground text-sm font-semibold">{row.value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 py-4">
                <dt className="text-muted-foreground text-sm">{t.confirm.createdAt}</dt>
                <dd className="text-foreground text-sm font-semibold">{date}</dd>
              </div>
            </dl>
          </div>

          {/* Selected dentists */}
          <div>
            <h2 className="font-display text-foreground mb-3 text-lg font-bold">
              {t.confirm.recipients}
            </h2>
            <ul className="border-border/60 bg-card divide-border/60 divide-y rounded-lg border">
              {dentists.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-foreground font-semibold">{d.dentistName}</p>
                    <p className="text-muted-foreground text-xs">
                      {d.clinicName} ✦ {d.city}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href={`/request/${id}/dentists`}
              className="text-teal-deep mt-3 inline-block text-sm font-semibold underline-offset-4 hover:underline"
            >
              {t.confirm.editSelection}
            </Link>
          </div>

          {/* Phone verification — an invitation, not a gate. Sending is allowed
              either way; this only explains why verifying is worth 30 seconds. */}
          {!user.phoneVerifiedAt && (
            <div className="border-border/60 bg-muted/40 flex flex-col gap-3 rounded-lg border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-foreground text-sm font-semibold">
                  {user.phone ? t.confirm.phoneVerifyTitle : t.confirm.phoneMissingTitle}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t.confirm.phoneBody}
                </p>
              </div>
              <Link
                href={`/verify-phone?next=${encodeURIComponent(`/request/${id}/confirm`)}`}
                className="border-teal-deep/40 text-teal-deep hover:bg-teal-deep/5 inline-flex shrink-0 items-center justify-center rounded-lg border px-5 py-2.5 text-sm font-semibold"
              >
                {user.phone ? t.confirm.phoneVerifyCta : t.confirm.phoneAddCta}
              </Link>
            </div>
          )}

          {/* Send */}
          <div className="border-border/60 flex flex-col gap-4 border-t pt-8">
            <div className="bg-muted/40 text-muted-foreground rounded-lg px-5 py-4 text-sm">
              {t.confirm.freeNoticePrefix}{" "}
              <span className="text-foreground font-semibold">{t.confirm.freeNoticeStrong}</span>{" "}
              {t.confirm.freeNoticeSuffix}
            </div>
            <div className="flex flex-col-reverse items-stretch justify-between gap-4 sm:flex-row sm:items-center">
              <Link
                href="/dashboard"
                className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center text-sm font-medium underline-offset-4 hover:underline"
              >
                {t.confirm.backToDashboard}
              </Link>
              <SubmitButton requestId={request.id} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
