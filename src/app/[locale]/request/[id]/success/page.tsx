import { LocaleLink as Link } from "@/i18n/locale-link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { fulfillRequest } from "@/server/fulfillment";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { plural } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { RefreshWhileSending } from "@/components/request/refresh-while-sending";

// Delivery normally lands within seconds of the submit action returning. A
// request still SUBMITTED after this long lost its background run, and this
// page finishes it rather than leaving it to the daily cron.
const STALLED_AFTER_MS = 2 * 60 * 1000;

function isStalled(submittedAt: Date): boolean {
  return Date.now() - submittedAt.getTime() > STALLED_AFTER_MS;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.requestFlow.successMetaTitle };
}

export const dynamic = "force-dynamic";

export default async function RequestSuccessPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  if (!user) redirect("/sign-in");

  const request = await db.request.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true, updatedAt: true },
  });
  if (!request || request.userId !== user.id) notFound();

  // The submit action delivers in the background, so SUBMITTED on arrival is
  // normal and this page just watches it. Only a request stuck there is
  // delivered from here — fulfillRequest claims each recipient before sending,
  // so racing a background run that is merely slow emails no clinic twice.
  if (request.status === "SUBMITTED" && isStalled(request.updatedAt)) {
    await fulfillRequest(id);
  }

  const fresh = await db.request.findUnique({
    where: { id },
    select: {
      status: true,
      _count: { select: { requestDentists: { where: { emailSent: true } } } },
    },
  });
  const dentistCount = fresh?._count.requestDentists ?? 0;
  const sent = fresh?.status === "SENT";
  const sending = fresh?.status === "SUBMITTED";

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-20 text-center lg:py-28">
          {sending && <RefreshWhileSending />}
          <div
            className="bg-teal-deep/10 text-teal-deep inline-flex h-16 w-16 items-center justify-center rounded-full"
            aria-hidden="true"
          >
            {sending ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <CheckCircle2 className="animate-in zoom-in-50 h-8 w-8 duration-500" />
            )}
          </div>

          <div aria-live="polite">
            <h1 className="font-display text-foreground mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              {sent
                ? t.requestFlow.successTitleSent
                : sending
                  ? t.requestFlow.successTitleSending
                  : t.requestFlow.successTitlePending}
            </h1>

            <p className="text-muted-foreground mx-auto mt-4 max-w-md text-lg text-pretty">
              {sent
                ? plural(t.requestFlow.successBodySent, dentistCount)
                : sending
                  ? t.requestFlow.successBodySending
                  : t.requestFlow.successBodyPending}
            </p>
          </div>

          {sent && (
            <div className="text-muted-foreground mt-8 inline-flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4" />
              {t.requestFlow.successWatchInbox}
            </div>
          )}

          <Link
            href="/dashboard"
            className={cn(
              buttonVariants(),
              "bg-teal-deep hover:bg-teal-deep/90 text-cream mt-10 inline-flex h-12 items-center gap-2 rounded-full px-7 text-base font-semibold",
            )}
          >
            {t.requestFlow.successToDashboard}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
