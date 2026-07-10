import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Mail } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { isPaymentsTestMode } from "@/lib/payments-mode";
import { fulfillPaidSession } from "@/server/fulfillment";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const metadata = {
  title: "הבקשה נשלחה",
};

export const dynamic = "force-dynamic";

export default async function RequestSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { id } = await params;
  const { session_id: sessionId } = await searchParams;
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  if (!user) redirect("/sign-in");

  const request = await db.request.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true },
  });
  if (!request || request.userId !== user.id) notFound();

  // Verify the session with Stripe and fulfill (idempotent). This makes the flow
  // work even without webhook forwarding in local dev; in production the webhook
  // will usually have fulfilled it already and this is a no-op.
  let dentistCount = 0;
  if (sessionId) {
    if (isPaymentsTestMode() || sessionId.startsWith("test_")) {
      // Test session: no provider to verify against — just confirm the synthetic
      // payment belongs to this request before fulfilling.
      const payment = await db.payment.findUnique({
        where: { providerRef: sessionId },
        select: { requestId: true },
      });
      if (payment?.requestId === id) {
        await fulfillPaidSession(sessionId);
      }
    } else {
      try {
        const session = await getStripe().checkout.sessions.retrieve(sessionId);
        if (session.payment_status === "paid" && session.metadata?.requestId === id) {
          await fulfillPaidSession(sessionId);
        }
      } catch (err) {
        console.error("Failed to verify Stripe session on success page:", err);
      }
    }
  }

  const fresh = await db.request.findUnique({
    where: { id },
    select: { status: true, _count: { select: { requestDentists: true } } },
  });
  dentistCount = fresh?._count.requestDentists ?? 0;
  const paid = fresh?.status === "PAID";

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-20 text-center lg:py-28">
          <div className="bg-teal-deep/10 text-teal-deep inline-flex h-16 w-16 items-center justify-center rounded-full">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <h1 className="font-display text-foreground mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {paid ? "הבקשה שלכם נשלחה! 🎉" : "התשלום בעיבוד…"}
          </h1>

          <p className="text-muted-foreground mt-4 max-w-md text-lg text-pretty">
            {paid ? (
              <>
                שלחנו את תוכנית הטיפול והצילום ל-{dentistCount} רופאים. הצעות המחיר יגיעו ישירות
                לאימייל שלכם — בדרך כלל תוך 48 שעות.
              </>
            ) : (
              <>קיבלנו את בקשתכם. ברגע שהתשלום יאושר נשלח את הבקשה לרופאים. נסו לרענן בעוד רגע.</>
            )}
          </p>

          {paid && (
            <div className="text-muted-foreground mt-8 inline-flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4" />
              עקבו אחר תיבת הדואר הנכנס (ולפעמים הספאם)
            </div>
          )}

          <Link
            href="/dashboard"
            className={cn(
              buttonVariants(),
              "bg-teal-deep hover:bg-teal-deep/90 text-cream mt-10 inline-flex h-12 items-center gap-2 rounded-full px-7 text-base font-semibold",
            )}
          >
            לאזור האישי
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
