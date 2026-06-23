import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, FileText, Image as ImageIcon, Users } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { PayButton } from "@/components/request/pay-button";
import { PRICING } from "@/lib/constants";

export const metadata = {
  title: "סיכום הבקשה",
};

export const dynamic = "force-dynamic";

export default async function ConfirmRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  if (!user) redirect("/sign-in");

  const request = await db.request.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      createdAt: true,
      treatmentFileUrl: true,
      xrayFileUrl: true,
      requestDentists: {
        select: {
          dentist: { select: { id: true, dentistName: true, clinicName: true, city: true } },
        },
      },
    },
  });

  if (!request || request.userId !== user.id) notFound();

  // Already paid → the request is locked and sent; send the user to the receipt.
  if (request.status === "PAID") redirect(`/request/${id}/success`);

  const filesReady = !!request.treatmentFileUrl && !!request.xrayFileUrl;
  if (!filesReady) redirect(`/request/${id}/upload`);

  const dentists = request.requestDentists.map((rd) => rd.dentist);
  if (dentists.length === 0) redirect(`/request/${id}/dentists`);

  const date = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(request.createdAt);

  // PAID requests are redirected above, so only PENDING/FAILED reach here.
  const statusLabel = request.status === "FAILED" ? "התשלום נכשל" : "ממתין לתשלום";

  const summaryRows = [
    { icon: Users, label: "רופאים נבחרים", value: `${dentists.length} רופאים` },
    { icon: FileText, label: "תוכנית טיפול", value: "הועלתה ✓" },
    { icon: ImageIcon, label: "צילום שיניים", value: "הועלה ✓" },
    { icon: CheckCircle2, label: "סטטוס תשלום", value: statusLabel },
  ];

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-border/60 bg-muted/30 border-b py-12 lg:py-16">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <p className="eyebrow">שלב 3 מתוך 3</p>
            <h1 className="font-display text-foreground mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              סיכום הבקשה לפני שליחה
            </h1>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              בדקו שהפרטים נכונים. לאחר התשלום הבקשה תישלח לכל הרופאים הנבחרים במקביל.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl space-y-8 px-6 py-10 lg:px-10 lg:py-14">
          {/* Summary card */}
          <div className="border-border/60 bg-card rounded-3xl border p-6 sm:p-8">
            <dl className="divide-border/60 divide-y">
              {summaryRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <dt className="text-muted-foreground inline-flex items-center gap-2 text-sm">
                    <row.icon className="text-teal-deep h-4 w-4" />
                    {row.label}
                  </dt>
                  <dd className="text-foreground text-sm font-semibold">{row.value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 py-4">
                <dt className="text-muted-foreground text-sm">תאריך יצירה</dt>
                <dd className="text-foreground text-sm font-semibold">{date}</dd>
              </div>
            </dl>
          </div>

          {/* Selected dentists */}
          <div>
            <h2 className="font-display text-foreground mb-3 text-lg font-bold">
              הרופאים שיקבלו את הבקשה
            </h2>
            <ul className="border-border/60 bg-card divide-border/60 divide-y rounded-3xl border">
              {dentists.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-foreground font-semibold">{d.dentistName}</p>
                    <p className="text-muted-foreground text-xs">
                      {d.clinicName} ✦ {d.city}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href={`/request/${id}/dentists`}
              className="text-teal-deep mt-3 inline-block text-sm font-semibold underline-offset-4 hover:underline"
            >
              עריכת בחירת הרופאים
            </Link>
          </div>

          {/* Payment + send */}
          <div className="border-border/60 flex flex-col gap-4 border-t pt-8">
            <div className="bg-muted/40 text-muted-foreground rounded-2xl px-5 py-4 text-sm">
              לאחר התשלום הבקשה תישלח אוטומטית לכל הרופאים הנבחרים, יחד עם הקבצים. סכום לתשלום:{" "}
              <span className="text-foreground font-semibold">{PRICING.flatFeeILS} ₪</span>.
            </div>
            <div className="flex flex-col-reverse items-stretch justify-between gap-4 sm:flex-row sm:items-center">
              <Link
                href="/dashboard"
                className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center text-sm font-medium underline-offset-4 hover:underline"
              >
                חזרה לאזור האישי
              </Link>
              <PayButton requestId={request.id} amount={PRICING.flatFeeILS} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
