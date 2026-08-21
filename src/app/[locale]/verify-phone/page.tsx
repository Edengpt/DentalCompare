import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { PhoneVerification } from "@/components/request/phone-verification";
import { getOrCreateUser } from "@/server/users";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.verifyPhone.metaTitle };
}

export const dynamic = "force-dynamic";

export default async function VerifyPhonePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);

  const { userId } = await auth();
  if (!userId) redirect(`/${locale}/sign-in`);

  const { next } = await searchParams;
  // Only accept same-origin paths — a raw `next` would otherwise be an open
  // redirect straight off the back of a sign-in.
  const redirectTo =
    next && next.startsWith("/") && !next.startsWith("//") ? next : `/${locale}/dashboard`;

  // getOrCreateUser reconciles Clerk's verification state, so an already-verified
  // user never sits on this screen.
  const user = await getOrCreateUser();
  if (user?.phoneVerifiedAt) redirect(redirectTo);

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-border/60 bg-muted/30 border-b py-12 lg:py-16">
          <div className="mx-auto max-w-xl px-6 lg:px-10">
            <p className="eyebrow">{t.verifyPhone.eyebrow}</p>
            <h1 className="font-display text-foreground mt-4 text-4xl font-bold tracking-tight text-balance">
              {t.verifyPhone.title}
            </h1>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              {t.verifyPhone.subtitle}
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-xl px-6 py-10 lg:px-10 lg:py-14">
          <PhoneVerification redirectTo={redirectTo} />
        </div>
      </main>
      <Footer />
    </>
  );
}
