import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { LocaleLink as Link } from "@/i18n/locale-link";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { getPageRequestStatus } from "@/lib/payplus";
import { retrieveCheckoutSessionWithSubscription } from "@/lib/stripe";
import { activateSubscriptionBySetupToken, syncStripeSubscription } from "@/server/subscriptions";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.clinics.returnMetaTitle };
}

export default async function BillingReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; status?: string; session_id?: string }>;
}) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  const { token, session_id } = await searchParams;

  const sub = token
    ? await db.clinicSubscription.findUnique({
        where: { setupToken: token },
        select: { status: true, pageRequestUid: true, provider: true },
      })
    : null;

  // Webhook-fallback activation: if PayPlus confirms the charge but we're still
  // PENDING (the IPN hasn't landed), activate now. We NEVER show success from the
  // URL status param — only from the DB state after a verified activation.
  if (token && sub?.status === "PENDING" && sub.provider === "PAYPLUS" && sub.pageRequestUid) {
    try {
      const { approved, transactionUid } = await getPageRequestStatus(sub.pageRequestUid);
      if (approved) {
        await activateSubscriptionBySetupToken({ setupToken: token, transactionUid });
      }
    } catch (err) {
      console.error("Billing return verification failed:", err);
    }
  }

  // Same idea for Stripe: if the checkout session's subscription exists but the
  // webhook (checkout.session.completed) hasn't landed yet, sync now from the
  // Checkout Session id Stripe appended to the redirect URL.
  if (token && sub?.status === "PENDING" && sub.provider === "STRIPE" && session_id) {
    try {
      const session = await retrieveCheckoutSessionWithSubscription(session_id);
      if (session.subscription) {
        await syncStripeSubscription({
          stripeSubscriptionId: session.subscription.id,
          stripeCustomerId:
            typeof session.subscription.customer === "string"
              ? session.subscription.customer
              : session.subscription.customer.id,
          status: session.subscription.status,
          // stripe@22.6.1 (the version actually installed) no longer exposes
          // Subscription.current_period_end at the top level; it moved to the
          // first line item. Every subscription this app creates has exactly
          // one item (see createSubscriptionCheckoutSession in src/lib/stripe.ts),
          // so items.data[0] is safe. Mirrors the webhook route's
          // subscriptionCurrentPeriodEnd helper (src/app/api/webhooks/stripe/route.ts).
          currentPeriodEnd: session.subscription.items.data[0]?.current_period_end
            ? new Date(session.subscription.items.data[0].current_period_end * 1000)
            : null,
          trialEndsAt: session.subscription.trial_end
            ? new Date(session.subscription.trial_end * 1000)
            : null,
          setupToken: token,
        });
      }
    } catch (err) {
      console.error("Billing return Stripe verification failed:", err);
    }
  }

  const fresh = token
    ? await db.clinicSubscription.findUnique({
        where: { setupToken: token },
        select: { status: true },
      })
    : null;

  // A Stripe subscription with a trial is correctly TRIALING right after
  // checkout — "ACTIVE only" was true for PayPlus (which charges immediately
  // on setup) but would show every successful Stripe signup as a failure.
  const success = fresh?.status === "ACTIVE" || fresh?.status === "TRIALING";

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-xl flex-1 flex-col items-center px-6 py-20 text-center">
        {success ? (
          <CheckCircle2 className="text-teal-deep h-14 w-14" />
        ) : (
          <XCircle className="text-coral h-14 w-14" />
        )}
        <h1 className="font-display text-foreground mt-6 text-2xl font-bold">
          {success ? t.clinics.returnSuccessTitle : t.clinics.returnFailedTitle}
        </h1>
        <p className="text-muted-foreground mt-3">
          {success
            ? t.clinics.returnSuccessBody
            : t.clinics.returnFailedBody}
        </p>
        <Link
          href="/"
          className="text-teal-deep mt-8 text-sm font-semibold underline-offset-4 hover:underline"
        >
          {t.clinics.returnHome}
        </Link>
      </main>
      <Footer />
    </>
  );
}
