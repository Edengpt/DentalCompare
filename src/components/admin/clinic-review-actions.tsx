"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { approveClinic, rejectClinic } from "@/server/admin-actions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function ClinicReviewActions({
  dentistId,
  clinicName,
}: {
  dentistId: string;
  clinicName: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveClinic(dentistId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${clinicName} אושרה ופורסמה במאגר`);
    });
  };

  const handleReject = () => {
    if (!window.confirm(`לדחות ולמחוק את ההרשמה של ${clinicName}? פעולה זו אינה הפיכה.`)) return;
    startTransition(async () => {
      const result = await rejectClinic(dentistId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`ההרשמה של ${clinicName} נדחתה`);
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
        אישור ופרסום
      </button>
      <button
        type="button"
        onClick={handleReject}
        disabled={isPending}
        className="border-border/60 text-muted-foreground hover:border-coral/50 hover:text-coral inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <X className="h-4 w-4" />
        דחייה
      </button>
    </div>
  );
}
