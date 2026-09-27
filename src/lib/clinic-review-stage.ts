/**
 * Where a registered clinic stands before approval, as the clinic should see it.
 *
 * "needsDocument" outranks "reviewing": once a document was sent back, the
 * review is waiting on the clinic, not on us, and saying "we're reviewing"
 * would leave it waiting for something that can't happen.
 */
export type ClinicReviewStage = "reviewing" | "needsDocument";

export function clinicReviewStage(clinic: {
  approvedAt: Date | null;
  documents: { rejectedAt: Date | null }[];
}): ClinicReviewStage | null {
  if (clinic.approvedAt) return null;
  return clinic.documents.some((d) => d.rejectedAt) ? "needsDocument" : "reviewing";
}
