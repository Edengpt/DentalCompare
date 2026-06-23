"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { toggleDentistActive } from "@/server/admin-actions";
import { cn } from "@/lib/utils";

export function ToggleActive({
  dentistId,
  isActive,
  pending,
}: {
  dentistId: string;
  isActive: boolean;
  pending?: boolean;
}) {
  const [isProcessing, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await toggleDentistActive(dentistId);
      if (!result.ok) toast.error(result.error);
    });
  };

  const label = isActive ? "פעיל" : pending ? "ממתינה — אשרו" : "מושבת";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isProcessing}
      title={isActive ? "לחצו להשבתה" : "לחצו להפעלה ופרסום במאגר"}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
        isActive
          ? "bg-teal-deep/10 text-teal-deep hover:bg-teal-deep/20"
          : pending
            ? "bg-coral/15 text-coral hover:bg-coral/25"
            : "bg-muted text-muted-foreground hover:bg-muted/80",
      )}
    >
      {label}
    </button>
  );
}
