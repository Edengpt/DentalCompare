"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { useT } from "@/i18n/provider";
import { approveQuote, rejectQuote, confirmCompletion } from "@/server/quote-decisions";
import type { QuoteStatus } from "@/generated/prisma/enums";

/**
 * The patient's per-quote action, one row of the comparison table at a time.
 *
 * Every button here fires a final, non-reversible transition (see the design
 * doc, §1.4) — there is deliberately no "undo" affordance.
 */
export function QuoteDecisionButtons({
  requestDentistId,
  status,
}: {
  requestDentistId: string;
  status: QuoteStatus;
}) {
  const t = useT().requestDetail;
  const [isPending, startTransition] = useTransition();

  const run = (action: (id: string) => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await action(requestDentistId);
      if (!result.ok) {
        toast.error(result.error ?? t.quoteActionFailed);
      }
    });
  };

  if (status === "PENDING_DECISION") {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(approveQuote)}
          className="bg-teal-deep text-cream rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {t.quoteActionApprove}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(rejectQuote)}
          className="text-coral border-coral/40 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {t.quoteActionReject}
        </button>
      </div>
    );
  }

  if (status === "APPROVED") {
    return (
      <span className="text-teal-deep inline-flex items-center gap-1 text-xs font-semibold">
        <CheckCircle2 className="h-3.5 w-3.5" /> {t.quoteStatusApproved}
      </span>
    );
  }

  if (status === "REJECTED") {
    return <span className="text-muted-foreground text-xs">{t.quoteStatusRejected}</span>;
  }

  if (status === "IN_TREATMENT") {
    return <span className="text-teal-deep text-xs font-semibold">{t.quoteStatusInTreatment}</span>;
  }

  if (status === "COMPLETION_REQUESTED") {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(confirmCompletion)}
        className="bg-teal-deep text-cream rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {t.quoteActionConfirmComplete}
      </button>
    );
  }

  // COMPLETED
  return (
    <span className="text-teal-deep inline-flex items-center gap-1 text-xs font-semibold">
      <CheckCircle2 className="h-3.5 w-3.5" /> {t.quoteStatusCompleted}
    </span>
  );
}
