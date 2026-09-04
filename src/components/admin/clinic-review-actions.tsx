"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { approveClinic, rejectClinic } from "@/server/admin-actions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function ClinicReviewActions({
  dentistId,
  clinicName,
  isActive,
}: {
  dentistId: string;
  clinicName: string;
  isActive: boolean;
}) {
  const t = useT();
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveClinic(dentistId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(format(t.admin.approved, { clinic: clinicName }));
    });
  };

  const handleReject = () => {
    if (!window.confirm(format(t.admin.rejectConfirm, { clinic: clinicName }))) return;
    startTransition(async () => {
      const result = await rejectClinic(dentistId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(format(t.admin.rejected, { clinic: clinicName }));
    });
  };

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={handleApprove}
        disabled={isPending}
        className={cn(
          buttonVariants(),
          "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <Check className="h-4 w-4" />
        {t.admin.approve}
      </button>
      {/* Reject deletes the row — refused server-side for an already-live
          clinic, but hiding the button here means an admin re-stamping a
          pre-licence-gate clinic never sees a button that can only error. */}
      {!isActive && (
        <button
          type="button"
          onClick={handleReject}
          disabled={isPending}
          className="border-border/60 text-muted-foreground hover:border-coral/50 hover:text-coral inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          {t.admin.reject}
        </button>
      )}
    </div>
  );
}
