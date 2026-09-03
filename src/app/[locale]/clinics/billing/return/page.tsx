import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { LocaleLink as Link } from "@/i18n/locale-link";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { getPageRequestStatus } from "@/lib/payplus";
import { retrieveCheckoutSessionWithSubscription, subscriptionCurrentPeriodEnd } from "@/lib/stripe";
import { activateSubscriptionBySetupToken, syncStripeSubscription } from "@/server/subscriptions";
import { hasCompletedPaymentSetup } from "@/lib/subscription";
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
        select: {
          status: true,
          pageRequestUid: true,
          provider: true,
          recurringToken: true,
          stripeSubscriptionId: true,
        },
      })
    : null;

  // Webhook-fallback activation: if PayPlus confirms the charge but payment
  // setup hasn't been recorded yet (the IPN hasn't landed), activate now. We
  // NEVER show success from the URL status param — only from the DB state
  // after a verified activation.
  if (token && sub && !hasCompletedPaymentSetup(sub) && sub.provider === "PAYPLUS" && sub.pageRequestUid) {
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
  if (token && sub && !hasCompletedPaymentSetup(sub) && sub.provider === "STRIPE" && session_id) {
    try {
      const session = await retrieveCheckoutSessionWithSubscription(session_id);
      // Only sync a session that actually belongs to this token — a session_id
      // for a different clinic's checkout must never be linked onto this row.
      if (session.subscription && session.metadata?.setupToken === token) {
        const currentPeriodEnd = subscriptionCurrentPeriodEnd(session.subscription);
        await syncStripeSubscription({
          stripeSubscriptionId: session.subscription.id,
          stripeCustomerId:
            typeof session.subscription.customer === "string"
              ? session.subscription.customer
              : session.subscription.customer.id,
          status: session.subscription.status,
          currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
          trialEndsAt: session.subscription.trial_end
            ? new Date(session.subscription.trial_end * 1000)
            : null,
          setupToken: token,
        });
      } else if (session.subscription) {
        console.error("Billing return: session_id does not belong to this token", { token });
      }
    } catch (err) {
      console.error("Billing return Stripe verification failed:", err);
    }
  }

  const fresh = token
    ? await db.clinicSubscription.findUnique({
        where: { setupToken: token },
        select: { status: true, provider: true, recurringToken: true, stripeSubscriptionId: true },
      })
    : null;

  // A Stripe subscription with a trial is correctly TRIALING right after
  // checkout — "ACTIVE only" was true for PayPlus (which charges immediately
  // on setup) but would show every successful Stripe signup as a failure. And
  // status alone can no longer distinguish "approved, nothing attempted" from
  // "trial genuinely started" (both are TRIALING) — hasCompletedPaymentSetup
  // checks the provider's actual payment-setup token instead.
  const success = fresh !== null && hasCompletedPaymentSetup(fresh);

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
