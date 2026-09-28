import type { BadgeTone } from "./request-badge";

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

export type AdminReviewStage = "noDocuments" | "needsDocument" | "missingStamp" | "reviewing";

/**
 * The same pending clinic as the admin sees it in the review queue: what is
 * waiting on the admin (orange) versus on the clinic (blue), and the case that
 * must never be approved as it stands (red — no document was ever seen).
 */
export function adminReviewStage(clinic: {
  isActive: boolean;
  documents: { rejectedAt: Date | null }[];
}): { stage: AdminReviewStage; tone: BadgeTone } {
  if (clinic.documents.length === 0) return { stage: "noDocuments", tone: "danger" };
  if (clinic.documents.some((d) => d.rejectedAt))
    return { stage: "needsDocument", tone: "waiting" };
  if (clinic.isActive) return { stage: "missingStamp", tone: "action" };
  return { stage: "reviewing", tone: "action" };
}
