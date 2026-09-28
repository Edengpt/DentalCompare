"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { markTreatmentStarted, requestCompletionConfirmation } from "@/server/quote-decisions";
import type { QuoteStatus } from "@/generated/prisma/enums";

/**
 * The clinic's per-lead status display and action, one row of the dashboard's
 * leads list at a time.
 *
 * Mirrors the patient-facing `QuoteDecisionButtons` (see
 * `src/components/request/quote-decision-buttons.tsx`): same
 * useTransition + sonner toast shape, one branch per status.
 */
export function QuoteStatusActions({
  requestDentistId,
  status,
}: {
  requestDentistId: string;
  status: QuoteStatus | null;
}) {
  const t = useT().clinics;
  const [isPending, startTransition] = useTransition();
  // The actions revalidate the dashboard; the request page needs a refresh of
  // its own for the badge beside the heading to follow.
  const router = useRouter();

  const run = (action: (id: string) => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await action(requestDentistId);
      if (!result.ok) toast.error(result.error ?? t.dashLeadActionFailed);
      else router.refresh();
    });
  };

  if (status === null) return <span className="text-xs font-medium text-amber-700">{t.dashLeadAwaiting}</span>;

  switch (status) {
    case "PENDING_DECISION":
      return <span className="text-teal-deep text-xs font-medium">{t.dashLeadPending}</span>;
    case "APPROVED":
      return (
        <div className="ms-auto flex items-center gap-2">
          <span className="text-teal-deep text-xs font-semibold">{t.dashLeadApproved}</span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(markTreatmentStarted)}
            className="bg-teal-deep text-cream rounded-lg px-3 py-1 text-xs font-semibold disabled:opacity-50"
          >
            {t.dashLeadMarkStarted}
          </button>
        </div>
      );
    case "REJECTED":
      return <span className="text-muted-foreground text-xs">{t.dashLeadRejected}</span>;
    case "IN_TREATMENT":
      return (
        <div className="ms-auto flex items-center gap-2">
          <span className="text-teal-deep text-xs font-semibold">{t.dashLeadInTreatment}</span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(requestCompletionConfirmation)}
            className="bg-teal-deep text-cream rounded-lg px-3 py-1 text-xs font-semibold disabled:opacity-50"
          >
            {t.dashLeadRequestCompletion}
          </button>
        </div>
      );
    case "COMPLETION_REQUESTED":
      return <span className="text-xs font-medium text-amber-700">{t.dashLeadCompletionRequested}</span>;
    case "COMPLETED":
      return <span className="text-teal-deep text-xs font-semibold">{t.dashLeadCompleted}</span>;
  }
}
