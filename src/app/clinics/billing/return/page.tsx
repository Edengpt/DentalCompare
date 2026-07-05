import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const dynamic = "force-dynamic";
export const metadata = { title: "סטטוס תשלום" };

export default async function BillingReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { token, status } = await searchParams;

  const sub = token
    ? await db.clinicSubscription.findUnique({
        where: { setupToken: token },
        select: { status: true, dentist: { select: { clinicName: true } } },
      })
    : null;

  const active = sub?.status === "ACTIVE";
  const success = active || status === "success";

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
          {success ? "התשלום התקבל!" : "התשלום לא הושלם"}
        </h1>
        <p className="text-muted-foreground mt-3">
          {success
            ? "המנוי הופעל. המרפאה מופיעה במאגר ותתחילו לקבל פניות ממטופלים."
            : "לא הצלחנו לאשר את התשלום. ניתן לנסות שוב מקישור ההפעלה שנשלח במייל."}
        </p>
        <Link
          href="/"
          className="text-teal-deep mt-8 text-sm font-semibold underline-offset-4 hover:underline"
        >
          חזרה לדף הבית
        </Link>
      </main>
      <Footer />
    </>
  );
}
