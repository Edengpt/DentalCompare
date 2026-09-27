import type { QuoteStatus, TreatmentActor } from "@/generated/prisma/enums";

/**
 * The four moments of a treatment after the patient chose a clinic, each done,
 * happening next, or still ahead — the shape of Booking's "upcoming trip".
 *
 * Derived from the quote's status and timestamps alone, so it cannot disagree
 * with the badge or the clinic's view of the same quote.
 */
export type TimelineStepKey = "approved" | "started" | "completionRequested" | "completed";
export type TimelineState = "done" | "current" | "upcoming";

export type TimelineStep = {
  key: TimelineStepKey;
  state: TimelineState;
  at: Date | null;
  /** Only on "started": who marked it. */
  by?: TreatmentActor;
};

export type TimelineInput = {
  status: QuoteStatus;
  decidedAt: Date | null;
  treatmentStartedAt: Date | null;
  treatmentStartedBy: TreatmentActor | null;
  completionRequestedAt: Date | null;
  completedAt: Date | null;
};

// How many steps are behind the patient in each status.
const DONE_COUNT: Partial<Record<QuoteStatus, number>> = {
  APPROVED: 1,
  IN_TREATMENT: 2,
  COMPLETION_REQUESTED: 3,
  COMPLETED: 4,
};

export function treatmentTimeline(q: TimelineInput): TimelineStep[] {
  const done = DONE_COUNT[q.status] ?? 0;
  const steps: Omit<TimelineStep, "state">[] = [
    { key: "approved", at: q.decidedAt },
    {
      key: "started",
      at: q.treatmentStartedAt,
      // Before patients could mark it, only the clinic did.
      ...(q.treatmentStartedAt ? { by: q.treatmentStartedBy ?? "CLINIC" } : {}),
    },
    { key: "completionRequested", at: q.completionRequestedAt },
    { key: "completed", at: q.completedAt },
  ];
  return steps.map((s, i) => ({
    ...s,
    state: i < done ? "done" : i === done ? "current" : "upcoming",
    at: i < done ? s.at : null,
  }));
}
