"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { deleteRequest } from "@/server/request-deletion";

/**
 * The patient's own delete button.
 *
 * Confirmed before it runs, and the confirmation says the files go too —
 * "delete my request" and "delete the x-ray I uploaded" are not obviously the
 * same thing to the person clicking, and only one of them is reversible by
 * uploading again.
 */
export function DeleteRequestButton({ requestId }: { requestId: string }) {
  const t = useT();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (!confirm(t.dashboard.deleteConfirm)) return;
    startTransition(async () => {
      const result = await deleteRequest(requestId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t.dashboard.deleted);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-muted-foreground hover:text-coral inline-flex items-center gap-1.5 text-xs font-medium underline-offset-4 transition-colors hover:underline disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      {t.dashboard.deleteRequest}
    </button>
  );
}
