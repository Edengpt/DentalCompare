import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { EXAMPLE_QUOTES, formatExampleMoney } from "@/lib/example-quotes";

/**
 * What a comparison looks like once the quotes are in. Every clinic, price and
 * rating here is made up, and the subtitle says so in as many words: a patient
 * must never read these as prices on offer.
 */
export function ExampleComparison({
  t,
  locale,
}: {
  t: Dictionary["exampleComparison"];
  locale: Locale;
}) {
  const [quoteA, quoteB, quoteC] = EXAMPLE_QUOTES;
  const money = (q: (typeof EXAMPLE_QUOTES)[number]) =>
    formatExampleMoney(locale, q.amount, q.currency);

  const clinics = [
    {
      name: t.clinicA,
      place: t.clinicAPlace,
      rating: quoteA.rating,
      price: money(quoteA),
      included: t.clinicAIncluded,
      visits: t.clinicAVisits,
      warranty: t.clinicAWarranty,
    },
    {
      name: t.clinicB,
      place: t.clinicBPlace,
      rating: quoteB.rating,
      price: money(quoteB),
      included: t.clinicBIncluded,
      visits: t.clinicBVisits,
      warranty: t.clinicBWarranty,
    },
    {
      name: t.clinicC,
      place: t.clinicCPlace,
      rating: quoteC.rating,
      price: money(quoteC),
      included: t.clinicCIncluded,
      visits: t.clinicCVisits,
      warranty: t.clinicCWarranty,
    },
  ];

  const rows = [
    { label: t.rowIncluded, cell: (c: (typeof clinics)[number]) => c.included },
    { label: t.rowVisits, cell: (c: (typeof clinics)[number]) => c.visits },
    { label: t.rowWarranty, cell: (c: (typeof clinics)[number]) => c.warranty },
  ];

  const th = "border-border border-b px-4 py-3 text-start align-top";
  const td = "border-border border-b border-s px-4 py-3 align-top";

  return (
    <section className="py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <h2 className="font-display text-foreground text-2xl font-bold sm:text-3xl">{t.title}</h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t.subtitle}</p>

        <div className="border-border mt-6 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">{t.subtitle}</caption>
            <thead className="bg-sand">
              <tr>
                <th scope="col" className={`${th} text-muted-foreground w-40 font-medium`}>
                  {t.plan}
                </th>
                {clinics.map((c) => (
                  <th key={c.name} scope="col" className={`${th} border-s`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-teal font-bold">{c.name}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                          {c.place}
                        </p>
                      </div>
                      {c.rating === null ? (
                        <span className="bg-highlight text-on-highlight rounded-sm px-2 py-0.5 text-xs font-bold">
                          {t.newBadge}
                        </span>
                      ) : (
                        <span
                          className="bg-teal-deep text-cream rounded-sm px-2 py-1 text-xs font-bold"
                          aria-label={format(t.ratingLabel, { rating: c.rating })}
                        >
                          {c.rating}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className={`${th} font-bold`}>
                  {t.rowPrice}
                </th>
                {clinics.map((c) => (
                  <td key={c.name} className={td}>
                    <p className="font-display text-foreground text-xl font-bold">{c.price}</p>
                  </td>
                ))}
              </tr>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className={`${th} font-bold`}>
                    {row.label}
                  </th>
                  {clinics.map((c) => (
                    <td key={c.name} className={`${td} text-foreground`}>
                      {row.cell(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
