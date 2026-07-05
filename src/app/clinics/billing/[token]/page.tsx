import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";
import { StartPaymentButton } from "@/components/clinics/start-payment-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "הפעלת מנוי" };

export default async function BillingSetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sub = await db.clinicSubscription.findUnique({
    where: { setupToken: token },
    select: {
      plan: true,
      priceILS: true,
      status: true,
      dentist: { select: { clinicName: true } },
    },
  });
  if (!sub) notFound();

  const planLabel = SUBSCRIPTION_PLANS[sub.plan as "MONTHLY" | "YEARLY"].labelHe;

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-xl flex-1 flex-col px-6 py-16">
        <h1 className="font-display text-foreground text-3xl font-bold">הפעלת מנוי</h1>
        <p className="text-muted-foreground mt-2">{sub.dentist.clinicName}</p>

        {sub.status === "ACTIVE" ? (
          <p className="border-border/60 bg-card mt-8 rounded-2xl border p-6 text-sm">
            המנוי כבר פעיל. המרפאה מופיעה במאגר.
          </p>
        ) : (
          <div className="border-border/60 bg-card mt-8 rounded-2xl border p-6">
            <p className="text-foreground text-lg font-semibold">
              מסלול {planLabel} — {sub.priceILS} ₪
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              לאחר התשלום המרפאה תופיע במאגר ותתחילו לקבל פניות. המנוי יתחדש אוטומטית בתום התקופה.
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
