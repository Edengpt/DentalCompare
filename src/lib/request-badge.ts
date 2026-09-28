import type { QuoteStatus, RequestStatus } from "@/generated/prisma/enums";

/**
 * The one badge a request shows in the patient's list: where it stands, and
 * above all whether it is waiting on the patient.
 *
 * Priority runs from "the chosen quote's progress" down to "still waiting", so
 * a request with one approved quote and two auto-rejected ones reads
 * "approved", not "declined". A pending quote outranks clinics still out: a
 * decision the patient can make now matters more than a reply they can only
 * wait for.
 */
export type BadgeKey =
  | "draft"
  | "sending"
  | "failed"
  | "waitingClinics"
  | "decisionNeeded"
  | "approved"
  | "inTreatment"
  | "confirmCompletion"
  | "completed"
  | "closed";

/** action = the patient has something to do; waiting = someone else does. */
export type BadgeTone = "action" | "waiting" | "positive" | "neutral" | "danger";

export type BadgeInput = {
  status: RequestStatus;
  /** Clinics the request was addressed to. */
  recipients: number;
  /** One entry per quote a clinic actually sent. */
  quotes: QuoteStatus[];
};

export type Badge = { key: BadgeKey; tone: BadgeTone; past: boolean };

const badge = (key: BadgeKey, tone: BadgeTone, past = false): Badge => ({ key, tone, past });

export function requestBadge({ status, recipients, quotes }: BadgeInput): Badge {
  if (status === "DRAFT") return badge("draft", "neutral");
  if (status === "SUBMITTED") return badge("sending", "waiting");
  if (status === "FAILED") return badge("failed", "danger");

  const has = (s: QuoteStatus) => quotes.includes(s);
  if (has("COMPLETED")) return badge("completed", "positive", true);
  // The clinic says it is done and only the patient can close it.
  if (has("COMPLETION_REQUESTED")) return badge("confirmCompletion", "action");
  if (has("IN_TREATMENT")) return badge("inTreatment", "positive");
  if (has("APPROVED")) return badge("approved", "positive");
  if (has("PENDING_DECISION")) return badge("decisionNeeded", "action");
  if (quotes.length < recipients) return badge("waitingClinics", "waiting");
  // Every clinic answered and every answer was declined: nothing left to happen.
  return badge("closed", "neutral", true);
}
