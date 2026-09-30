"use client";

import type { QuoteStatus } from "@/generated/prisma/enums";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/** Where a treatment stands, as a small badge. Shared by both sides' lists. */
export function TreatmentStatus({ status }: { status: QuoteStatus }) {
  const t = useT().treatments;
  const label =
    status === "COMPLETED"
      ? t.statusCompleted
      : status === "IN_TREATMENT" || status === "COMPLETION_REQUESTED"
        ? t.statusInTreatment
        : t.statusApproved;
  return (
    <span
      className={cn(
        "shrink-0 rounded-sm px-2 py-0.5 text-xs font-semibold",
        status === "COMPLETED" ? "bg-success/15 text-success" : "bg-teal/10 text-teal",
      )}
    >
      {label}
    </span>
  );
}
