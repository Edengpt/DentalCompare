import "server-only";
import { db } from "@/lib/db";

/**
 * The clinic-recipient row a quote token points at, if the clinic may still
 * write to its quote.
 *
 * Shared by submitQuote and the quote-attachment routes: both are authorized by
 * the same magic-link token and must refuse at the same moment — once this
 * quote, or any sibling quote on the request, has been decided.
 *
 * Not in quotes.ts because that file is "use server", which may only export
 * actions; an exported helper there would become a public endpoint.
 */
export async function loadEditableTarget(token: string) {
  if (!token) return { ok: false as const, error: "INVALID_LINK" as const };
  const rd = await db.requestDentist.findUnique({
    where: { quoteToken: token },
    select: {
      id: true,
      requestId: true,
      quote: { select: { id: true, status: true } },
      // The quote is denominated in the clinic's own country's currency.
      dentist: { select: { country: { select: { currency: true } } } },
      request: {
        select: { id: true, user: { select: { fullName: true, email: true, locale: true } } },
      },
    },
  });
  if (!rd) return { ok: false as const, error: "INVALID_LINK" as const };
  if (rd.quote && rd.quote.status !== "PENDING_DECISION") {
    return { ok: false as const, error: "DECIDED" as const };
  }

  // A sibling quote on the same request may have already been approved (or
  // gone further) between the patient's decision and this write — approval
  // is exclusive per request, so no other clinic may still create or edit a
  // quote once that has happened.
  const decidedSibling = await db.quote.findFirst({
    where: {
      requestDentist: { requestId: rd.requestId },
      status: { in: ["APPROVED", "IN_TREATMENT", "COMPLETION_REQUESTED", "COMPLETED"] },
    },
    select: { id: true },
  });
  if (decidedSibling) return { ok: false as const, error: "DECIDED" as const };

  return { ok: true as const, rd };
}
