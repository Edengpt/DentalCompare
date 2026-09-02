import "server-only";
import { db } from "./db";
import { publicDentistWhere } from "./dentist-public";

/**
 * The numbers the homepage is allowed to show.
 *
 * The rule this module exists to enforce: the site never states a figure it
 * cannot measure. Every value here is read from the database on request, so
 * nothing has to be remembered, updated, or trusted — and a claim can never
 * drift away from what is true.
 *
 * A measurement below its floor comes back `null` rather than its real value.
 * That is not an error path: it is the normal state of a young marketplace,
 * and it is what tells the hero to show a fact about the mechanism instead.
 * `null` rather than 0 on purpose — 0 is a measurement ("nobody replied"),
 * `null` is "there is not yet anything to measure".
 */

/**
 * The slice of the Prisma client these measurements need.
 *
 * Structural rather than the concrete client so a transaction client satisfies
 * it too. Every figure here is a global aggregate, so a test cannot assert on
 * one without owning the table state — and the only way to own it without
 * touching real rows is to seed inside a transaction and roll it back.
 */
export type StatsClient = Pick<typeof db, "dentist" | "$queryRaw">;

export type HomepageStats = {
  /** Clinics a patient can actually reach, or null below the floor. */
  clinics: number | null;
  /** Whole percent, 0–100, or null below the floor. */
  responseRate: number | null;
  /** Minor units plus its ISO 4217 code, or null below the floor. */
  medianSpread: { minor: number; currency: string } | null;
};

/**
 * How much evidence a figure needs before it helps rather than hurts.
 *
 * These are judgement, not arithmetic. "12 clinics" in a hero strip argues
 * against the site more effectively than any competitor could, and a response
 * rate over 20 requests moves four points every time one clinic is slow — that
 * is noise wearing the clothes of a statistic. Turn the dials if experience
 * says otherwise; they are here in one place for exactly that reason.
 */
export const STAT_FLOORS = {
  clinics: 25,
  /** Requests whose 48-hour window has already closed. */
  responseRate: 25,
  /** Requests carrying at least two comparable quotes. */
  medianSpread: 10,
} as const;

/** The window a clinic has to reply before a request counts as unanswered. */
const RESPONSE_WINDOW_HOURS = 48;

async function countClinics(client: StatsClient): Promise<number | null> {
  // publicDentistWhere(), not a copy of its parts. The figure has to count what
  // a patient can reach, which is by definition what the directory shows — and
  // this used to spell that definition out by hand, so when the licence stamp
  // joined the gate the number silently kept counting clinics the directory had
  // stopped showing. Sharing the clause is what stops that happening again.
  const count = await client.dentist.count({ where: publicDentistWhere() });
  return count >= STAT_FLOORS.clinics ? count : null;
}

async function responseRate(client: StatsClient): Promise<number | null> {
  // Only requests whose window has closed. A request sent an hour ago has not
  // failed to get a reply yet, and counting it as unanswered would drag the
  // figure down permanently in proportion to how busy the site is.
  //
  // Raw SQL because the comparison is between columns of different tables —
  // Quote.createdAt against Request.sentAt — which the Prisma query API cannot
  // express.
  const [row] = await client.$queryRaw<Array<{ total: number; answered: number }>>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE q.first_quote_at IS NOT NULL
          AND q.first_quote_at <= r."sentAt" + make_interval(hours => ${RESPONSE_WINDOW_HOURS})
      )::int AS answered
    FROM "Request" r
    LEFT JOIN LATERAL (
      SELECT MIN(quote."createdAt") AS first_quote_at
      FROM "RequestDentist" rd
      JOIN "Quote" quote ON quote."requestDentistId" = rd.id
      WHERE rd."requestId" = r.id
    ) q ON TRUE
    WHERE r.status = 'SENT'
      AND r."sentAt" IS NOT NULL
      AND r."sentAt" <= NOW() - make_interval(hours => ${RESPONSE_WINDOW_HOURS})
  `;

  const total = row?.total ?? 0;
  if (total < STAT_FLOORS.responseRate) return null;
  return Math.round(((row?.answered ?? 0) / total) * 100);
}

async function medianSpread(
  client: StatsClient,
): Promise<{ minor: number; currency: string } | null> {
  // The gap between the highest and lowest quote for one treatment plan.
  //
  // Deliberately not "average saving": saving is a difference against what the
  // patient would have paid otherwise, which is a parallel world the platform
  // never sees. The spread is simply a measurement, and it happens to be the
  // product's whole thesis.
  //
  // Median, not mean — one clinic quoting a wild number drags a mean into a
  // figure no patient ever experienced, while the median keeps reporting what
  // a typical one sees.
  //
  // Requests priced in more than one currency are excluded rather than
  // converted: converting would fold a rate the platform does not control into
  // a number it presents as fact. Among single-currency requests the most
  // common currency wins, and the median is reported in it.
  const [row] = await client.$queryRaw<
    Array<{ currency: string; sample: number; median_spread: bigint }>
  >`
    WITH per_request AS (
      SELECT
        rd."requestId"                AS request_id,
        MIN(quote.currency)           AS currency,
        COUNT(DISTINCT quote.currency) AS currencies,
        COUNT(*)                      AS quotes,
        MAX(quote."amountMinor") - MIN(quote."amountMinor") AS spread
      FROM "Quote" quote
      JOIN "RequestDentist" rd ON rd.id = quote."requestDentistId"
      WHERE quote."amountMinor" IS NOT NULL AND quote.currency IS NOT NULL
      GROUP BY rd."requestId"
    ),
    eligible AS (
      SELECT currency, spread FROM per_request WHERE quotes >= 2 AND currencies = 1
    ),
    dominant AS (
      SELECT currency, COUNT(*)::int AS n
      FROM eligible GROUP BY currency ORDER BY n DESC, currency ASC LIMIT 1
    )
    SELECT
      d.currency,
      d.n AS sample,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY e.spread)::bigint AS median_spread
    FROM dominant d
    JOIN eligible e ON e.currency = d.currency
    GROUP BY d.currency, d.n
  `;

  if (!row || row.sample < STAT_FLOORS.medianSpread) return null;
  return { minor: Number(row.median_spread), currency: row.currency };
}

/**
 * All three measurements, each gated independently.
 *
 * Independently on purpose: the clinic count crosses its floor months before
 * ten requests have carried two quotes each, and there is no reason for the
 * first to wait on the third.
 */
export async function getHomepageStats(client: StatsClient = db): Promise<HomepageStats> {
  const [clinics, rate, spread] = await Promise.all([
    countClinics(client),
    responseRate(client),
    medianSpread(client),
  ]);
  return { clinics, responseRate: rate, medianSpread: spread };
}
