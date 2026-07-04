import { notFound } from "next/navigation";
import { FileText, Image as ImageIcon } from "lucide-react";
import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { QuoteForm } from "@/components/quote/quote-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "הגשת הצעת מחיר" };

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rd = await db.requestDentist.findUnique({
    where: { quoteToken: token },
    select: {
      quote: { select: { amountILS: true, note: true } },
      request: {
        select: {
          treatmentFileUrl: true,
          xrayFileUrl: true,
          user: { select: { fullName: true } },
        },
      },
    },
  });
  if (!rd) notFound();

  const firstName = rd.request.user.fullName.split(" ")[0];
  const files = [
    { icon: FileText, label: "תוכנית הטיפול", url: rd.request.treatmentFileUrl },
    { icon: ImageIcon, label: "צילום שיניים", url: rd.request.xrayFileUrl },
  ].filter((f) => !!f.url);

  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-16">
        <h1 className="font-display text-foreground text-3xl font-bold">
          הצעת מחיר עבור {firstName}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          עיינו בתוכנית הטיפול ובצילום, והזינו מחיר. שלב אחד — לוקח 5 שניות.
        </p>

        {files.length > 0 && (
          <ul className="border-border/60 bg-card divide-border/60 mt-6 divide-y rounded-2xl border">
            {files.map((f) => (
              <li key={f.label} className="flex items-center justify-between gap-3 p-4">
                <span className="text-foreground inline-flex items-center gap-2.5 text-sm font-medium">
                  <f.icon className="text-teal-deep h-4 w-4" />
                  {f.label}
                </span>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-deep text-sm font-semibold underline-offset-4 hover:underline"
                >
                  צפייה בקובץ
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          <QuoteForm
            token={token}
            initialAmount={rd.quote?.amountILS ?? null}
            initialNote={rd.quote?.note ?? null}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
