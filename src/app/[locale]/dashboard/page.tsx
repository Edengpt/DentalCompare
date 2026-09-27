import { LocaleLink as Link } from "@/i18n/locale-link";
import { FilePlus } from "lucide-react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getOrCreateUser } from "@/server/users";
import { RequestList } from "@/components/request/request-list";
import { isAdminEmail } from "@/server/admin";
import { db } from "@/lib/db";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { ForwardArrow } from "@/components/ui/forward-arrow";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.dashboard.metaTitle };
}

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getDictionary(locale);

  const { userId } = await auth();
  if (!userId) redirect(`/${locale}/sign-in`);

  const profile = await getOrCreateUser();
  const clerkUser = await currentUser();
  const greetingName =
    clerkUser?.firstName ?? clerkUser?.username ?? t.dashboard.fallbackGreetingName;
  const showAdminLink = !!profile && isAdminEmail(profile.email);

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });
  const requests = user
    ? await db.request.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          treatmentFileUrl: true,
          xrayFileUrl: true,
          requestDentists: { select: { quote: { select: { status: true } } } },
        },
      })
    : [];

  const hasRequests = requests.length > 0;

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
          <div className="flex items-center justify-between gap-4">
            <p className="eyebrow">{t.dashboard.eyebrow}</p>
            {showAdminLink && (
              <Link
                href="/admin"
                className="text-muted-foreground hover:text-teal-deep text-sm font-medium underline-offset-4 hover:underline"
              >
                {t.dashboard.adminPanel}
              </Link>
            )}
          </div>

          <div className="mt-5 flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="font-display text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
              {t.dashboard.greeting} {greetingName} 👋
            </h1>
            <Link
              href="/request/new"
              className={cn(
                buttonVariants(),
                "bg-accent text-accent-foreground hover:bg-accent/90 inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold shadow-md",
              )}
            >
              <FilePlus className="h-4 w-4" />
              {t.dashboard.newRequest}
              <ForwardArrow className="h-4 w-4" />
            </Link>
          </div>

          {!hasRequests ? (
            <div className="border-border/60 bg-card mt-12 rounded-3xl border border-dashed p-12 text-center">
              <h2 className="font-display text-foreground text-xl font-bold">
                {t.dashboard.emptyTitle}
              </h2>
              <p className="text-muted-foreground mx-auto mt-3 max-w-md text-pretty">
                {t.dashboard.emptyBody}
              </p>
              <Link
                href="/request/new"
                className={cn(
                  buttonVariants(),
                  "bg-teal-deep hover:bg-teal-deep/90 text-cream mt-6 inline-flex h-11 items-center gap-2 rounded-full px-6 font-semibold",
                )}
              >
                <FilePlus className="h-4 w-4" />
                {t.dashboard.emptyCta}
              </Link>
            </div>
          ) : (
            <RequestList
              t={t}
              locale={locale}
              rows={requests.map((r) => ({
                id: r.id,
                status: r.status,
                createdAt: r.createdAt,
                filesReady: !!r.treatmentFileUrl && !!r.xrayFileUrl,
                recipients: r.requestDentists.length,
                quotes: r.requestDentists.flatMap((rd) => (rd.quote ? [rd.quote.status] : [])),
              }))}
            />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
