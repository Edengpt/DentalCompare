import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { formatMoney } from "@/lib/money";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";
import { StartPaymentButton } from "@/components/clinics/start-payment-button";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.clinics.billingMetaTitle };
}

export default async function BillingSetupPage({
  params,
}: {
  params: Promise<{ token: string; locale: string }>;
}) {
  const { token, locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  const sub = await db.clinicSubscription.findUnique({
    where: { setupToken: token },
    select: {
      plan: true,
      priceMinor: true,
      currency: true,
      status: true,
      dentist: { select: { clinicName: true } },
    },
  });
  if (!sub) notFound();

  const planLabel = sub.plan === "MONTHLY" ? t.emails.planMonthly : t.emails.planYearly;

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-xl flex-1 flex-col px-6 py-16">
        <h1 className="font-display text-foreground text-3xl font-bold">{t.clinics.billingTitle}</h1>
        <p className="text-muted-foreground mt-2">{sub.dentist.clinicName}</p>

        {sub.status === "ACTIVE" ? (
          <p className="border-border/60 bg-card mt-8 rounded-2xl border p-6 text-sm">
            {t.clinics.billingAlreadyActive}
          </p>
        ) : (
          <div className="border-border/60 bg-card mt-8 rounded-2xl border p-6">
            <p className="text-foreground text-lg font-semibold">
              {format(t.clinics.billingPlanLine, {
                plan: planLabel,
                price: formatMoney(sub.priceMinor ?? 0, sub.currency ?? "ILS", locale),
              })}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {t.clinics.billingAfterPayment}
            </p>
            <div className="mt-6">
              <StartPaymentButton setupToken={token} />
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
