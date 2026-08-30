"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { replaceClinicDocuments } from "@/server/clinic-documents";
import { DOC_ACCEPT_ATTRIBUTE, DOC_MAX_FILE_SIZE_MB } from "@/lib/clinic-documents";
import { cn } from "@/lib/utils";

type RejectedDocument = { id: string; kind: string; rejectionReason: string | null };

/**
 * Where a clinic with no account replaces a document an admin refused.
 *
 * One document at a time, submitted as soon as it uploads: a clinic on a phone
 * that photographs one licence should not have to find a submit button, and a
 * batch that half-succeeds would be worse than two small successes.
 */
export function ReplaceDocumentsForm({
  token,
  documents,
}: {
  token: string;
  documents: RejectedDocument[];
}) {
  const t = useT();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handle = async (doc: RejectedDocument, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Checked here too: a file over the platform's request limit never reaches
    // the server at all, and the clinic is left with an error retrying cannot fix.
    if (file.size > DOC_MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(format(t.validation.documentSize, { mb: DOC_MAX_FILE_SIZE_MB }));
      e.target.value = "";
      return;
    }

    setBusy(doc.id);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/clinics/documents", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) {
        toast.error(data?.error ?? t.clinics.regDocFailed);
        return;
      }

      const fd = new FormData();
      fd.append("token", token);
      fd.append("documentId", doc.id);
      fd.append("documentUrl", data.url);
      fd.append("documentType", file.type);

      startTransition(async () => {
        const result = await replaceClinicDocuments(fd);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setDone((prev) => ({ ...prev, [doc.id]: true }));
        toast.success(t.clinics.replaceDone);
      });
    } catch {
      toast.error(t.clinics.regDocFailed);
    } finally {
      setBusy(null);
      e.target.value = "";
    }
  };

  return (
    <div className="mt-8 space-y-3">
      {documents.map((doc) => (
        <div key={doc.id} className="border-border/60 bg-card rounded-2xl border p-5">
          <p className="text-foreground font-medium">{doc.kind}</p>
          {doc.rejectionReason && (
            <p className="text-muted-foreground mt-1 text-sm">{doc.rejectionReason}</p>
          )}
          <div className="mt-4">
            {done[doc.id] ? (
              <span className="text-teal-deep inline-flex items-center gap-1.5 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                {t.clinics.replaceReceived}
              </span>
            ) : (
              <label
                className={cn(
                  "border-border/60 text-muted-foreground hover:border-teal-deep/40 hover:text-teal-deep inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed px-4 py-2 text-sm transition-colors",
                  busy === doc.id && "pointer-events-none opacity-60",
                )}
              >
                {busy === doc.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                {t.clinics.regDocUpload}
                <input
                  type="file"
                  accept={DOC_ACCEPT_ATTRIBUTE}
                  onChange={(e) => handle(doc, e)}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      ))}
      <p className="text-muted-foreground pt-2 text-xs">
        {format(t.clinics.replaceHint, { mb: DOC_MAX_FILE_SIZE_MB })}
      </p>
    </div>
  );
}
