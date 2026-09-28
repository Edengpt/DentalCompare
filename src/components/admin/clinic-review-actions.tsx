"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { approveClinic, rejectClinic } from "@/server/admin-actions";
import { ConfirmDialog } from "@/components/request/confirm-dialog";

/**
 * Approve and reject for one pending clinic, each behind a confirmation that
 * says what the clinic will receive. After either, the clinic is no longer
 * pending, so the admin is taken back to the list.
 */
export function ClinicReviewActions({
  dentistId,
  clinicName,
  isActive,
  canApprove,
}: {
  dentistId: string;
  clinicName: string;
  isActive: boolean;
  /** False when there is no document to have looked at — approving unseen is what the promise forbids. */
  canApprove: boolean;
}) {
  const t = useT().admin;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");

  const done = (message: string) => {
    toast.success(message);
    setConfirming(null);
    router.push("/admin/clinics");
  };

  const approve = () =>
    startTransition(async () => {
      const result = await approveClinic(dentistId);
      if (!result.ok) return void toast.error(result.error);
      done(format(t.approved, { clinic: clinicName }));
    });

  const reject = () =>
    startTransition(async () => {
      const result = await rejectClinic(dentistId, reason);
      if (!result.ok) return void toast.error(result.error);
      done(format(t.rejected, { clinic: clinicName }));
    });

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={() => setConfirming("approve")}
        disabled={isPending || !canApprove}
        className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-6 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
        {t.approve}
      </button>
      {/* Reject deletes the row — refused server-side for an already-live
          clinic, but hiding the button here means an admin re-stamping a
          pre-licence-gate clinic never sees a button that can only error. */}
      {!isActive && (
        <button
          type="button"
          onClick={() => setConfirming("reject")}
          disabled={isPending}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-red-600/40 px-5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          {t.reject}
        </button>
      )}

      <ConfirmDialog
        open={confirming === "approve"}
        onCancel={() => setConfirming(null)}
        onConfirm={approve}
        pending={isPending}
        title={format(t.approveConfirmTitle, { clinic: clinicName })}
        confirmLabel={t.approveConfirmYes}
        tone="approve"
        irreversible={false}
      >
        <p>{t.approveConfirmBody}</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirming === "reject"}
        onCancel={() => setConfirming(null)}
        onConfirm={reject}
        pending={isPending}
        title={format(t.rejectConfirmTitle, { clinic: clinicName })}
        confirmLabel={t.rejectConfirmYes}
        tone="danger"
      >
        <p>{t.rejectConfirmBody}</p>
        <label className="text-foreground mt-3 block text-sm font-medium">
          {t.rejectReasonLabel}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={t.rejectReasonPlaceholder}
            className="border-border/60 bg-background focus:border-teal-deep mt-1.5 block w-full rounded-lg border px-3 py-2 text-sm font-normal outline-none"
          />
        </label>
      </ConfirmDialog>
    </div>
  );
}
