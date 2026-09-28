"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { format, plural } from "@/i18n/format";
import { approveQuote, rejectQuote } from "@/server/quote-decisions";
import type { QuoteStatus } from "@/generated/prisma/enums";
import { StatusBadge } from "./status-badge";
import { ConfirmDialog } from "./confirm-dialog";

type Decision = "approve" | "reject";

/**
 * The patient's per-quote action, one column of the comparison table at a time.
 *
 * Every button here fires a final, non-reversible transition (see the design
 * doc, §1.4) — there is deliberately no "undo" affordance. That is exactly why
 * approving and declining each go through a confirmation that says what will
 * happen: one mis-tap on a phone used to approve a clinic and decline the rest.
 *
 * Once a quote is chosen, what happens next lives in the treatment card above
 * the table (start, completion); this cell only reports where the quote stands.
 */
export function QuoteDecisionButtons({
  requestDentistId,
  status,
  rejectedAuto,
  clinicName,
  otherPending,
}: {
  requestDentistId: string;
  status: QuoteStatus;
  rejectedAuto: boolean;
  clinicName: string;
  /** Other quotes on this request still awaiting a decision — the ones approving this one declines. */
  otherPending: number;
}) {
  const t = useT().requestDetail;
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<Decision | null>(null);

  const run = (action: (id: string) => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await action(requestDentistId);
      setConfirming(null);
      if (!result.ok) {
        toast.error(result.error ?? t.quoteActionFailed);
      }
    });
  };

  if (status === "PENDING_DECISION") {
    return (
      <div className="flex flex-col items-start gap-2.5">
        <StatusBadge tone="action">{t.quoteBadgePending}</StatusBadge>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirming("approve")}
            className="bg-coral hover:bg-coral/90 rounded-full px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50"
          >
            {t.quoteActionApprove}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirming("reject")}
            className="border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {t.quoteActionReject}
          </button>
        </div>

        <ConfirmDialog
          open={confirming !== null}
          onCancel={() => setConfirming(null)}
          onConfirm={() => run(confirming === "reject" ? rejectQuote : approveQuote)}
          pending={isPending}
          title={format(confirming === "reject" ? t.confirmRejectTitle : t.confirmApproveTitle, {
            clinic: clinicName,
          })}
          confirmLabel={confirming === "reject" ? t.confirmRejectYes : t.confirmApproveYes}
          tone={confirming === "reject" ? "quiet" : "primary"}
        >
          <p>{confirming === "reject" ? t.confirmRejectBody : t.confirmApproveBody}</p>
          {confirming === "approve" && otherPending > 0 && (
            <p className="text-foreground">{plural(t.confirmApproveOthers, otherPending)}</p>
          )}
        </ConfirmDialog>
      </div>
    );
  }

  if (status === "REJECTED") {
    return (
      <StatusBadge tone="neutral">
        {rejectedAuto ? t.quoteStatusRejectedAuto : t.quoteStatusRejected}
      </StatusBadge>
    );
  }

  if (status === "COMPLETION_REQUESTED") {
    return <StatusBadge tone="action">{t.quoteBadgeCompletionRequested}</StatusBadge>;
  }

  const label = {
    APPROVED: t.quoteStatusApproved,
    IN_TREATMENT: t.quoteStatusInTreatment,
    COMPLETED: t.quoteStatusCompleted,
  }[status];
  return <StatusBadge tone="positive">{label}</StatusBadge>;
}
