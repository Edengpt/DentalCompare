"use client";

import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { fileValidationMessage } from "@/i18n/validation-message";
import { QUOTE_LIMITS } from "@/lib/quote-catalog";
import {
  QUOTE_ATTACHMENT_ACCEPT,
  validateQuoteAttachment,
  type QuoteAttachmentInfo,
} from "@/lib/quote-attachments";
import { removeQuoteAttachment, uploadQuoteAttachment } from "@/lib/upload-quote-attachment";

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Documents for the patient: a treatment plan, an x-ray, a photo.
 *
 * Each file is uploaded and attached the moment it is chosen, not on submit —
 * files go browser-direct to storage and can't ride along in the quote
 * action. They become visible to the patient once the quote is submitted.
 *
 * `canPreview` is false on the emailed-link page: that clinic has no session,
 * and the alternative — putting the quote token in a view URL — would leak it
 * into browser history. The clinic has the files locally anyway.
 */
export function QuoteAttachments({
  token,
  requestId,
  requestDentistId,
  initial,
  canPreview,
}: {
  token: string;
  requestId: string;
  requestDentistId: string;
  initial: QuoteAttachmentInfo[];
  canPreview: boolean;
}) {
  const t = useT();
  const q = t.quoteForm;
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState(initial);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const full = files.length >= QUOTE_LIMITS.maxAttachments;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    const invalid = validateQuoteAttachment(file);
    if (invalid) {
      setError(fileValidationMessage(t.validation, invalid, QUOTE_LIMITS.attachmentMaxMB));
      return;
    }
    setProgress(0);
    const res = await uploadQuoteAttachment(file, { token, requestId, requestDentistId }, (p) =>
      setProgress(p),
    );
    setProgress(null);
    if (res.ok) setFiles((prev) => [...prev, res.attachment]);
    else setError(res.message ?? q.documentsFailed);
  }

  async function onRemove(id: string) {
    setError(null);
    if (await removeQuoteAttachment(id, token)) {
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } else {
      setError(q.documentsFailed);
    }
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-foreground mb-1 text-sm font-semibold">{q.documentsLegend}</legend>
      <p className="text-muted-foreground -mt-1 text-xs">
        {format(q.documentsHint, {
          max: QUOTE_LIMITS.maxAttachments,
          mb: QUOTE_LIMITS.attachmentMaxMB,
        })}
      </p>

      {files.length > 0 && (
        <ul className="divide-border/60 border-border/60 divide-y rounded-lg border">
          {files.map((f) => {
            const Icon = f.contentType === "application/pdf" ? FileText : ImageIcon;
            return (
              <li key={f.id} className="flex items-center gap-2.5 p-3 text-sm">
                <Icon className="text-teal-deep h-4 w-4 shrink-0" />
                <span className="text-foreground min-w-0 flex-1 truncate" dir="auto">
                  {f.name}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {sizeLabel(f.sizeBytes)}
                </span>
                {canPreview && (
                  <a
                    href={`/api/quote-attachments/${f.id}`}
                    target="_blank"
                    rel="noopener"
                    className="text-teal-deep shrink-0 text-xs font-medium underline"
                  >
                    {q.documentsView}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(f.id)}
                  aria-label={q.documentsRemove}
                  className="text-muted-foreground hover:text-alert -m-1 shrink-0 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={QUOTE_ATTACHMENT_ACCEPT}
        onChange={onPick}
        className="hidden"
      />
      {full ? (
        <p className="text-muted-foreground text-xs">
          {format(q.documentsLimit, { max: QUOTE_LIMITS.maxAttachments })}
        </p>
      ) : (
        <button
          type="button"
          disabled={progress !== null}
          onClick={() => inputRef.current?.click()}
          className="border-border/60 text-foreground hover:border-teal-deep/50 inline-flex items-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-sm disabled:opacity-60"
        >
          <Paperclip className="h-4 w-4" />
          {progress !== null ? `${q.documentsUploading} ${Math.round(progress)}%` : q.documentsAdd}
        </button>
      )}
      {error && <p className="text-alert text-sm">{error}</p>}
    </fieldset>
  );
}
