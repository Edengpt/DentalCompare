"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
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
  const t = useT();
  const [isProcessing, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await toggleDentistActive(dentistId);
      if (!result.ok) toast.error(result.error);
    });
  };

  const label = isActive
    ? t.admin.statusActive
    : pending
      ? t.admin.statusPending
      : t.admin.statusInactive;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isProcessing}
      title={isActive ? t.admin.toggleToDisable : t.admin.toggleToEnable}
      className={cn(
        "rounded-sm px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
        isActive
          ? "bg-teal-deep/10 text-teal-deep hover:bg-teal-deep/20"
          : pending
            ? "bg-highlight/40 text-on-highlight hover:bg-highlight/60"
            : "bg-muted text-muted-foreground hover:bg-muted/80",
      )}
    >
      {label}
    </button>
  );
}
