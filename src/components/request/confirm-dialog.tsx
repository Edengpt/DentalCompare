"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * "Are you sure?" for the patient's final, non-reversible steps: it names what
 * will happen, says it can't be undone, and holds while the action runs.
 */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  pending,
  title,
  children,
  confirmLabel,
  tone = "primary",
  irreversible = true,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  /**
   * primary = the step the user came to take; quiet = a step away from it;
   * approve / danger = an admin's green light and its irreversible opposite.
   */
  tone?: "primary" | "quiet" | "approve" | "danger";
  irreversible?: boolean;
}) {
  const t = useT().requestDetail;
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="data-open:animate-in data-open:fade-in-0 fixed inset-0 z-50 bg-black/40" />
        <AlertDialog.Popup className="bg-card data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl sm:p-8">
          <AlertDialog.Title className="font-display text-foreground text-xl font-bold text-balance">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description
            render={<div />}
            className="text-muted-foreground mt-3 space-y-2 text-sm text-pretty"
          >
            {children}
            {irreversible && (
              <p className="text-alert inline-flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {t.confirmIrreversible}
              </p>
            )}
          </AlertDialog.Description>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close
              disabled={pending}
              className="border-border text-foreground hover:bg-muted h-11 rounded-full border px-5 text-sm font-semibold disabled:opacity-50"
            >
              {t.confirmCancel}
            </AlertDialog.Close>
            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold disabled:opacity-70",
                {
                  primary: "bg-coral hover:bg-coral/90 text-white",
                  quiet: "bg-foreground text-background hover:bg-foreground/90",
                  approve: "bg-emerald-600 text-white hover:bg-emerald-700",
                  danger: "bg-red-600 text-white hover:bg-red-700",
                }[tone],
              )}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
