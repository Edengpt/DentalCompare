import type { QuoteStatus } from "@/generated/prisma/enums";
import type { BadgeTone } from "./request-badge";

/**
 * Where one incoming request stands from the clinic's side, and which tab of its
 * "incoming requests" list it belongs in.
 *
 * Kept out of the page so the rules are testable and the list, its tab counts
 * and the request page can never disagree about them.
 */
export type LeadStage =
  | "needsQuote"
  | "missed"
  | "quoteSent"
  | "chosen"
  | "inTreatment"
  | "awaitingPatient"
  | "completed"
  | "notChosen";

export type LeadTab = "all" | "action" | "sent" | "treatment" | "closed";

export const LEAD_TABS: Record<LeadTab, readonly LeadStage[]> = {
  all: [
    "needsQuote",
    "missed",
    "quoteSent",
    "chosen",
    "inTreatment",
    "awaitingPatient",
    "completed",
    "notChosen",
  ],
  // Waiting on the clinic: a quote to write, or a patient who chose it and is
  // waiting to hear back. Being chosen is also the start of treatment, so it
  // shows under both.
  action: ["needsQuote", "chosen"],
  sent: ["quoteSent"],
  treatment: ["chosen", "inTreatment", "awaitingPatient"],
  closed: ["completed", "notChosen", "missed"],
};

export function clinicLeadStage(lead: {
  /** This clinic's quote on the request, null while it has not sent one. */
  status: QuoteStatus | null;
  /** The patient already chose some clinic on this request. */
  decidedElsewhere: boolean;
}): { stage: LeadStage; tone: BadgeTone } {
  switch (lead.status) {
    case null:
      // A quote sent now could no longer be chosen — asking for one would
      // waste the clinic's time.
      return lead.decidedElsewhere
        ? { stage: "missed", tone: "neutral" }
        : { stage: "needsQuote", tone: "action" };
    case "PENDING_DECISION":
      return { stage: "quoteSent", tone: "waiting" };
    case "APPROVED":
      return { stage: "chosen", tone: "action" };
    case "IN_TREATMENT":
      return { stage: "inTreatment", tone: "positive" };
    case "COMPLETION_REQUESTED":
      return { stage: "awaitingPatient", tone: "waiting" };
    case "COMPLETED":
      return { stage: "completed", tone: "positive" };
    case "REJECTED":
      return { stage: "notChosen", tone: "neutral" };
  }
}

// Statuses in which the patient has chosen a clinic for the request.
const DECIDED: readonly QuoteStatus[] = [
  "APPROVED",
  "IN_TREATMENT",
  "COMPLETION_REQUESTED",
  "COMPLETED",
];

/**
 * Whether the patient already chose some OTHER clinic on this request. Read
 * from the sibling rows on the server; which clinic, and at what price, never
 * reaches the clinic asking.
 */
export function decidedElsewhere(
  ownId: string,
  siblings: { id: string; quote: { status: QuoteStatus } | null }[],
): boolean {
  return siblings.some(
    (o) => o.id !== ownId && o.quote !== null && DECIDED.includes(o.quote.status),
  );
}
