"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { LocaleLink as Link } from "@/i18n/locale-link";
import { useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { confirmCompletion, declineCompletion } from "@/server/quote-decisions";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * The clinic says the treatment is done; only the patient can close it.
 *
 * Loud on purpose, and shown both on the dashboard and on the request itself:
 * it is the one moment the whole treatment waits on the patient. "Still
 * ongoing" is not final — the clinic can ask again — so it goes straight
 * through; "yes, complete" is final and is confirmed first.
 */
export function CompletionBanner({
  requestDentistId,
  clinicName,
  detailsHref,
}: {
  requestDentistId: string;
  clinicName: string;
  /** On the dashboard, a way into the request. Omitted on the request page itself. */
  detailsHref?: string;
}) {
  const t = useT().requestDetail;
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const run = (
    action: (id: string) => Promise<{ ok: boolean; error?: string }>,
    doneMessage?: string,
  ) =>
    startTransition(async () => {
      const result = await action(requestDentistId);
      setConfirming(false);
      if (!result.ok) toast.error(result.error ?? t.quoteActionFailed);
      else if (doneMessage) toast.success(doneMessage);
    });

  return (
    <div role="status" className="border-coral/40 bg-coral/10 rounded-3xl border-2 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="bg-coral inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-foreground text-lg font-bold text-balance">
            {format(t.bannerTitle, { clinic: clinicName })}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">{t.bannerBody}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirming(true)}
              className="bg-coral hover:bg-coral/90 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
            >
              {t.bannerYes}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(declineCompletion, t.declinedToast)}
              className="border-border bg-background text-foreground hover:border-foreground/30 rounded-full border px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {t.bannerNo}
            </button>
            {detailsHref && (
              <Link
                href={detailsHref}
                className="text-teal-deep ms-1 text-sm font-semibold underline-offset-4 hover:underline"
              >
                {t.bannerView}
              </Link>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={() => run(confirmCompletion)}
        pending={isPending}
        title={format(t.confirmCompleteTitle, { clinic: clinicName })}
        confirmLabel={t.bannerYes}
      >
        <p>{t.confirmCompleteBody}</p>
      </ConfirmDialog>
    </div>
  );
}
