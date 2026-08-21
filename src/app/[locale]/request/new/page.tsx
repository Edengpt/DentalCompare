import { LocaleLink as Link } from "@/i18n/locale-link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/server/users";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function NewRequestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);

  const { userId } = await auth();
  if (!userId) redirect(`/${locale}/sign-in?redirect_url=/${locale}/request/new`);

  const user = await getOrCreateUser();
  if (!user) redirect(`/${locale}/sign-in`);

  // Reuse the most recent PENDING request if one exists without files yet —
  // saves users from creating multiple empty requests on accidental refresh.
  const existing = await db.request.findFirst({
    where: {
      userId: user.id,
      status: "DRAFT",
      treatmentFileUrl: "",
      xrayFileUrl: "",
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) redirect(`/${locale}/request/${existing.id}/upload`);

  // Only creating a genuinely new request is rate-limited — reusing an empty one
  // above is free, so refreshing never trips this. Caps request-spam per user.
  const rl = await rateLimit(
    `create-request:${user.id}`,
    RATE_LIMITS.createRequest.limit,
    RATE_LIMITS.createRequest.windowMs,
  );
  if (!rl.allowed) {
    return (
      <>
        <Header />
        <main className="flex-1">
          <div className="mx-auto max-w-md px-6 py-24 text-center">
            <h1 className="font-display text-foreground text-2xl font-bold">
              {t.request.rateLimitedTitle}
            </h1>
            <p className="text-muted-foreground mt-3 text-pretty">{t.request.rateLimitedBody}</p>
            <Link
              href="/dashboard"
              className="text-teal-deep mt-6 inline-block text-sm font-semibold underline-offset-4 hover:underline"
            >
              {t.request.backToDashboard}
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const created = await db.request.create({
    data: {
      userId: user.id,
      treatmentFileUrl: "",
      xrayFileUrl: "",
    },
    select: { id: true },
  });

  redirect(`/${locale}/request/${created.id}/upload`);
}
