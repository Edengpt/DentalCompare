"use client";

import { useState, useTransition } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useT } from "@/i18n/provider";
import { format, plural } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { approveQuote, rejectQuote, confirmCompletion } from "@/server/quote-decisions";
import type { QuoteStatus } from "@/generated/prisma/enums";
import { StatusBadge } from "./status-badge";

type Decision = "approve" | "reject";

/**
 * The patient's per-quote action, one column of the comparison table at a time.
 *
 * Every button here fires a final, non-reversible transition (see the design
 * doc, §1.4) — there is deliberately no "undo" affordance. That is exactly why
 * approving and declining each go through a confirmation that says what will
 * happen: one mis-tap on a phone used to approve a clinic and decline the rest.
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

        <AlertDialog.Root
          open={confirming !== null}
          onOpenChange={(open) => {
            if (!open && !isPending) setConfirming(null);
          }}
        >
          <AlertDialog.Portal>
            <AlertDialog.Backdrop className="data-open:animate-in data-open:fade-in-0 fixed inset-0 z-50 bg-black/40" />
            <AlertDialog.Popup className="bg-card data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl sm:p-8">
              <AlertDialog.Title className="font-display text-foreground text-xl font-bold text-balance">
                {format(confirming === "reject" ? t.confirmRejectTitle : t.confirmApproveTitle, {
                  clinic: clinicName,
                })}
              </AlertDialog.Title>
              <AlertDialog.Description
                render={<div />}
                className="text-muted-foreground mt-3 space-y-2 text-sm text-pretty"
              >
                <p>{confirming === "reject" ? t.confirmRejectBody : t.confirmApproveBody}</p>
                {confirming === "approve" && otherPending > 0 && (
                  <p className="text-foreground">{plural(t.confirmApproveOthers, otherPending)}</p>
                )}
                <p className="text-coral inline-flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {t.confirmIrreversible}
                </p>
              </AlertDialog.Description>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <AlertDialog.Close
                  disabled={isPending}
                  className="border-border text-foreground hover:bg-muted h-11 rounded-full border px-5 text-sm font-semibold disabled:opacity-50"
                >
                  {t.confirmCancel}
                </AlertDialog.Close>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(confirming === "reject" ? rejectQuote : approveQuote)}
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold disabled:opacity-70",
                    confirming === "reject"
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "bg-coral hover:bg-coral/90 text-white",
                  )}
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {confirming === "reject" ? t.confirmRejectYes : t.confirmApproveYes}
                </button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
    );
  }

  if (status === "APPROVED") {
    return <StatusBadge tone="positive">{t.quoteStatusApproved}</StatusBadge>;
  }

  if (status === "REJECTED") {
    return (
      <StatusBadge tone="neutral">
        {rejectedAuto ? t.quoteStatusRejectedAuto : t.quoteStatusRejected}
      </StatusBadge>
    );
  }

  if (status === "IN_TREATMENT") {
    return <StatusBadge tone="positive">{t.quoteStatusInTreatment}</StatusBadge>;
  }

  if (status === "COMPLETION_REQUESTED") {
    return (
      <div className="flex flex-col items-start gap-2.5">
        <StatusBadge tone="action">{t.quoteBadgeCompletionRequested}</StatusBadge>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(confirmCompletion)}
          className="bg-teal-deep text-cream rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {t.quoteActionConfirmComplete}
        </button>
      </div>
    );
  }

  // COMPLETED
  return <StatusBadge tone="positive">{t.quoteStatusCompleted}</StatusBadge>;
}
