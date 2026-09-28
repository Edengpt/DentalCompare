"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileWarning } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { requestBetterDocuments } from "@/server/admin-actions";
import { cn } from "@/lib/utils";

/**
 * "This document is not good enough" — one reason field per document.
 *
 * A reason is what selects a document, rather than a separate checkbox: the
 * text IS the email the clinic receives, and "send it again" with no reason
 * produces the same photograph a second time.
 */
export function RequestDocumentsForm({
  dentistId,
  clinicName,
  documents,
}: {
  dentistId: string;
  clinicName: string;
  documents: { id: string; kind: string }[];
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const chosen = Object.entries(reasons).filter(([, reason]) => reason.trim() !== "");

  const submit = () => {
    startTransition(async () => {
      const result = await requestBetterDocuments(
        dentistId,
        chosen.map(([documentId, reason]) => ({ documentId, reason })),
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(format(t.admin.docsRequested, { clinic: clinicName }));
      setReasons({});
      setOpen(false);
      // The review page shows which documents were sent back; refresh it so
      // the one just marked says so without a reload.
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border/60 text-muted-foreground hover:border-alert/50 hover:text-alert inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium transition-colors"
      >
        <FileWarning className="h-4 w-4" />
        {t.admin.requestBetterDocs}
      </button>
    );
  }

  return (
    <div className="border-border/60 bg-muted/30 w-full rounded-lg border p-4">
      <p className="text-foreground text-sm font-semibold">{t.admin.requestBetterDocsTitle}</p>
      <p className="text-muted-foreground mt-1 text-xs">{t.admin.requestBetterDocsHint}</p>
      <div className="mt-3 space-y-3">
        {documents.map((doc) => (
          <div key={doc.id} className="flex flex-col gap-1.5">
            <label htmlFor={`reason-${doc.id}`} className="text-foreground text-sm font-medium">
              {doc.kind}
            </label>
            <input
              id={`reason-${doc.id}`}
              type="text"
              value={reasons[doc.id] ?? ""}
              onChange={(ev) => setReasons((prev) => ({ ...prev, [doc.id]: ev.target.value }))}
              placeholder={t.admin.requestBetterDocsPlaceholder}
              className="border-border/60 bg-background focus:border-teal-deep focus:ring-teal-deep/20 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={isPending || chosen.length === 0}
          className={cn(
            "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {t.admin.requestBetterDocsSend}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground text-sm font-medium"
        >
          {t.admin.reject}
        </button>
      </div>
    </div>
  );
}
