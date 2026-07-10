import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Mail } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getPageRequestStatus } from "@/lib/payplus";
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
  searchParams: Promise<{ payment?: string }>;
}) {
  const { id } = await params;
  const { payment: paymentId } = await searchParams;
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  if (!user) redirect("/sign-in");

  const request = await db.request.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true },
  });
  if (!request || request.userId !== user.id) notFound();

  // Verify the payment with PayPlus and fulfill (idempotent). This makes the flow
  // work even without webhook forwarding in local dev; in production the webhook
  // will usually have fulfilled it already and this is a no-op.
  let dentistCount = 0;
  if (paymentId) {
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      select: { requestId: true, providerRef: true },
    });
    // Only fulfill a payment that actually belongs to this request.
    if (payment?.requestId === id) {
      const isTest = isPaymentsTestMode() || payment.providerRef.startsWith("test_");
      if (isTest) {
        // Test payment: no provider to verify against — fulfill directly.
        await fulfillPaidSession(payment.providerRef);
      } else {
        try {
          const { approved } = await getPageRequestStatus(payment.providerRef);
          if (approved) {
            await fulfillPaidSession(payment.providerRef);
          }
        } catch (err) {
          console.error("Failed to verify PayPlus payment on success page:", err);
        }
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
