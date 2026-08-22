import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale, defaultLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { toMajor } from "@/lib/money";
import { notFound } from "next/navigation";
import { FileText, Image as ImageIcon } from "lucide-react";
import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { QuoteForm } from "@/components/quote/quote-form";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: t.quoteForm.metaTitle };
}

export default async function QuotePage({
  params,
}: {
  params: Promise<{ token: string; locale: string }>;
}) {
  const { token, locale } = await params;
  const t = await getDictionary(isLocale(locale) ? locale : defaultLocale);
  const rd = await db.requestDentist.findUnique({
    where: { quoteToken: token },
    select: {
      quote: {
        select: {
          amountMinor: true,
          currency: true,
          note: true,
          includes: true,
          tripsRequired: true,
          daysPerTrip: true,
          weeksBetweenTrips: true,
          warrantyYears: true,
          warrantyNote: true,
        },
      },
      // The quote is priced in the clinic's own country's currency, so the form
      // has to label the field with it rather than assume shekels.
      dentist: { select: { country: { select: { currency: true } } } },
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

  // Two different unknowns collapse to the same label here: the account was
  // deleted, or the patient never gave a name. Neither is the dentist's problem.
  const firstName = rd.request.user?.fullName?.split(" ")[0] ?? t.quoteForm.fallbackPatient;
  const currency = rd.quote?.currency ?? rd.dentist.country.currency;
  const files = [
    { icon: FileText, label: t.requestDetail.treatmentPlan, url: rd.request.treatmentFileUrl },
    { icon: ImageIcon, label: t.requestDetail.xray, url: rd.request.xrayFileUrl },
  ].filter((f) => !!f.url);

  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-16">
        <h1 className="font-display text-foreground text-3xl font-bold">
          {format(t.quoteForm.pageTitle, { name: firstName })}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">{t.quoteForm.pageSubtitle}</p>

        {files.length > 0 && (
          <div className="border-border/60 bg-card mt-6 rounded-2xl border p-4">
            <p className="text-muted-foreground text-sm">{t.quoteForm.attachmentsNote}</p>
            <ul className="divide-border/60 mt-3 divide-y">
              {files.map((f) => (
                <li
                  key={f.label}
                  className="text-foreground flex items-center gap-2.5 py-2 text-sm font-medium"
                >
                  <f.icon className="text-teal-deep h-4 w-4" />
                  {f.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6">
          <QuoteForm
            token={token}
            currencyLabel={currency}
            initial={{
              amount: rd.quote ? toMajor(rd.quote.amountMinor ?? 0, currency) : null,
              note: rd.quote?.note ?? null,
              includes: rd.quote?.includes ?? [],
              tripsRequired: rd.quote?.tripsRequired ?? 1,
              daysPerTrip: rd.quote?.daysPerTrip ?? 1,
              weeksBetweenTrips: rd.quote?.weeksBetweenTrips ?? null,
              warrantyYears: rd.quote?.warrantyYears ?? null,
              warrantyNote: rd.quote?.warrantyNote ?? null,
            }}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
