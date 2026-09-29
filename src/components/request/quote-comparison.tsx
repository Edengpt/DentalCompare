import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { QuoteRow } from "@/lib/quotes";
import { formatMoney } from "@/lib/money";
import { translateInclusion, translateLanguage } from "@/lib/labels";
import { format } from "@/i18n/format";
import { QuoteDecisionButtons } from "./quote-decision-buttons";
import { StatusBadge } from "./status-badge";

/**
 * Three quotes side by side, one dimension per row.
 *
 * A stack of cards makes you scroll to compare and remember what the last one
 * said. The whole claim of the product — that the lowest price is almost never
 * the cheapest quote — is only visible when what's included, how many trips and
 * how long the warranty runs sit on the same line across clinics.
 *
 * Two rules hold the honesty of this table:
 *
 *  - **A blank is not a zero.** A clinic that didn't state a warranty shows
 *    "not stated", never "0 years". One of those is an accusation.
 *  - **The clinic's own currency is always the figure.** Any conversion is
 *    secondary, marked approximate and dated, and disappears entirely rather
 *    than being shown stale.
 */

export type ConvertedPrice = { minor: number; fetchedAt: Date } | null;

export function QuoteComparison({
  t,
  locale,
  quotes,
  cheapestId,
  patientCurrency,
  converted,
}: {
  t: Dictionary;
  locale: Locale;
  quotes: QuoteRow[];
  cheapestId: string | null;
  patientCurrency: string;
  /** Pre-computed on the server, keyed by dentistId. Null where no honest rate exists. */
  converted: Record<string, ConvertedPrice>;
}) {
  const d = t.requestDetail;
  const notStated = <span className="text-muted-foreground/70">{d.notStated}</span>;

  const tripsCell = (q: QuoteRow) => {
    if (q.tripsRequired === null) return notStated;
    if (q.tripsRequired === 1) return format(d.oneTrip, { days: q.daysPerTrip ?? 1 });
    return (
      format(d.manyTrips, { trips: q.tripsRequired, days: q.daysPerTrip ?? 1 }) +
      (q.weeksBetweenTrips ? format(d.weeksBetween, { weeks: q.weeksBetweenTrips }) : "")
    );
  };

  const sessionsCell = (q: QuoteRow) => {
    if (q.sessionsRequired === null) return notStated;
    if (q.sessionsRequired === 1) return d.oneSession;
    return (
      format(d.manySessions, { sessions: q.sessionsRequired }) +
      (q.weeksBetweenSessions
        ? format(d.weeksBetweenSessions, { weeks: q.weeksBetweenSessions })
        : "")
    );
  };

  const priceCell = (q: QuoteRow) => {
    if (q.amountMinor === null || !q.currency) {
      return <span className="text-muted-foreground text-xs">{d.awaitingQuote}</span>;
    }
    const conversion = converted[q.dentistId];
    return (
      <>
        <span className="text-foreground text-lg font-bold">
          {formatMoney(q.amountMinor, q.currency, locale)}
        </span>
        {/* Only when the rate is current. A converted figure is a courtesy; a
            stale one presented beside a real price is a claim. */}
        {conversion && q.currency !== patientCurrency && (
          <span className="text-muted-foreground mt-1 block text-xs">
            ≈ {formatMoney(conversion.minor, patientCurrency, locale)}
            <span className="block">
              {format(d.approxRate, {
                date: new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(
                  conversion.fetchedAt,
                ),
              })}
            </span>
          </span>
        )}
      </>
    );
  };

  const rows: Array<{ label: string; cell: (q: QuoteRow) => React.ReactNode }> = [
    {
      label: d.rowStatus,
      cell: (q) =>
        q.status ? (
          <QuoteDecisionButtons
            requestDentistId={q.requestDentistId}
            status={q.status}
            rejectedAuto={q.rejectedAuto}
            clinicName={q.clinicName}
            otherPending={
              quotes.filter(
                (o) => o.requestDentistId !== q.requestDentistId && o.status === "PENDING_DECISION",
              ).length
            }
          />
        ) : (
          <StatusBadge tone="waiting">{d.awaitingQuote}</StatusBadge>
        ),
    },
    { label: d.rowPrice, cell: priceCell },
    {
      label: d.rowLocation,
      cell: (q) => [q.country, q.city].filter(Boolean).join(" ✦ ") || notStated,
    },
    {
      label: d.rowIncludes,
      cell: (q) =>
        q.includes.length ? (
          <span className="flex flex-wrap gap-1.5">
            {q.includes.map((key) => (
              <span
                key={key}
                className="bg-teal-deep/10 text-teal-deep rounded-sm px-2 py-0.5 text-xs"
              >
                {translateInclusion(t.labels, key)}
                {key === "ACCOMMODATION" && q.accommodationNights
                  ? format(d.accommodationNights, { nights: q.accommodationNights })
                  : ""}
              </span>
            ))}
          </span>
        ) : (
          notStated
        ),
    },
    { label: d.rowTrips, cell: tripsCell },
    { label: d.rowSessions, cell: sessionsCell },
    {
      label: d.rowWarranty,
      cell: (q) =>
        q.warrantyYears === null ? (
          notStated
        ) : (
          <>
            {format(d.warranty, { years: q.warrantyYears })}
            {q.warrantyNote && (
              <span className="text-muted-foreground mt-1 block text-xs whitespace-pre-wrap">
                {q.warrantyNote}
              </span>
            )}
          </>
        ),
    },
    {
      label: d.rowLanguages,
      cell: (q) =>
        q.spokenLanguages.length
          ? q.spokenLanguages.map((l) => translateLanguage(t.labels, l)).join(" ✦ ")
          : notStated,
    },
    { label: d.rowNote, cell: (q) => q.note || notStated },
  ];

  const [statusRow, priceRow, ...detailRows] = rows;

  return (
    <>
      {/* Phones: one card per clinic, stacked. A three-column table at 390px
          meant scrolling sideways to compare and hunting for the approve
          buttons at the far edge. */}
      <ul className="space-y-4 sm:hidden">
        {quotes.map((q) => (
          <li key={q.dentistId} className="border-border/60 bg-card rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-foreground font-semibold">{q.clinicName}</p>
                <p className="text-muted-foreground text-xs">{q.dentistName}</p>
              </div>
              {q.dentistId === cheapestId && (
                <span className="bg-teal-deep/10 text-teal-deep shrink-0 rounded-sm px-2 py-0.5 text-xs font-semibold">
                  {d.cheapest}
                </span>
              )}
            </div>
            {/* A clinic that hasn't answered yet has nothing to list: seven
                "not stated" lines would bury the ones that did. */}
            {q.status !== null && (
              <>
                <div className="mt-3">{priceRow.cell(q)}</div>
                <dl className="divide-border/60 mt-3 divide-y text-sm">
                  {detailRows.map((row) => (
                    <div key={row.label} className="grid grid-cols-[7rem_1fr] gap-3 py-2">
                      <dt className="text-muted-foreground text-xs">{row.label}</dt>
                      <dd className="text-foreground">{row.cell(q)}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <div className="border-border/60 mt-3 border-t pt-3">{statusRow.cell(q)}</div>
          </li>
        ))}
      </ul>

      {/* From sm up: the side-by-side table. It scrolls inside this box; the
        page never scrolls sideways. */}
      <div className="border-border/60 bg-card hidden overflow-x-auto rounded-lg border sm:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-border/60 border-b">
              <th className="text-muted-foreground w-32 px-4 py-3 text-start text-xs font-medium">
                {d.rowClinic}
              </th>
              {quotes.map((q) => (
                <th key={q.dentistId} className="px-4 py-3 text-start align-top">
                  <span className="text-foreground block font-semibold">{q.clinicName}</span>
                  <span className="text-muted-foreground block text-xs font-normal">
                    {q.dentistName}
                  </span>
                  {q.dentistId === cheapestId && (
                    <span className="bg-teal-deep/10 text-teal-deep mt-1.5 inline-block rounded-sm px-2 py-0.5 text-xs font-semibold">
                      {d.cheapest}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {rows.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="text-muted-foreground bg-muted/30 px-4 py-3 text-start align-top text-xs font-medium"
                >
                  {row.label}
                </th>
                {quotes.map((q) => (
                  <td key={q.dentistId} className="text-foreground px-4 py-3 align-top">
                    {row.cell(q)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
