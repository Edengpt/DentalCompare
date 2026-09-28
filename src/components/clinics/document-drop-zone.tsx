"use client";

import { useState } from "react";
import { CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  DOC_ACCEPT_ATTRIBUTE,
  DOC_MAX_FILE_SIZE_MB,
  validateClinicDocument,
} from "@/lib/clinic-documents";
import { uploadClinicDocument } from "@/lib/upload-clinic-document";
import { useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { cn } from "@/lib/utils";

export type UploadedDoc = { url: string; contentType: string; fileName: string };

/**
 * One licence slot: drop a file on it or click to pick one, watch it upload,
 * see it accepted.
 *
 * Owns only the upload in flight. What is attached lives with the form, because
 * the form has to post it and has to drop it when the country changes.
 */
export function DocumentDropZone({
  kind,
  doc,
  onUploaded,
  onRemove,
}: {
  kind: string;
  doc: UploadedDoc | undefined;
  onUploaded: (doc: UploadedDoc) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [dragging, setDragging] = useState(false);
  // null = idle. A number is bytes travelling; "checking" is the server reading
  // them back, which is a separate wait the clinic should not mistake for a hang.
  const [progress, setProgress] = useState<number | "checking" | null>(null);

  const handleFile = async (file: File) => {
    // The accept attribute filters the picker but not a drop, so both paths are
    // checked here — and instantly, not after the clinic has waited for bytes.
    const invalid = validateClinicDocument(file);
    if (invalid === "TYPE") return void toast.error(t.validation.documentType);
    if (invalid === "SIZE") {
      return void toast.error(format(t.validation.documentSize, { mb: DOC_MAX_FILE_SIZE_MB }));
    }

    setProgress(0);
    try {
      const result = await uploadClinicDocument(file, (pct) =>
        setProgress(pct >= 100 ? "checking" : pct),
      );
      if (!result.ok) {
        toast.error(result.message ?? t.clinics.regDocFailed);
        return;
      }
      onUploaded({ url: result.url, contentType: file.type, fileName: file.name });
    } finally {
      setProgress(null);
    }
  };

  if (doc) {
    return (
      <div className="border-teal-deep/40 bg-teal-deep/5 flex items-center gap-3 rounded-lg border px-4 py-3">
        <CheckCircle2 className="text-teal-deep h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-medium">{kind}</p>
          <p className="text-muted-foreground truncate text-xs">{doc.fileName}</p>
        </div>
        <span className="text-teal-deep text-xs font-medium">{t.clinics.regDocUploaded}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t.clinics.regDocRemove}
          className="text-muted-foreground hover:text-alert rounded-full p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const busy = progress !== null;

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && !busy) void handleFile(file);
      }}
      className={cn(
        "border-border/70 text-muted-foreground focus-within:ring-teal-deep/30 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors focus-within:ring-2",
        "hover:border-teal-deep/50 hover:bg-teal-deep/5",
        dragging && "border-teal-deep bg-teal-deep/10 text-teal-deep",
        busy && "pointer-events-none",
      )}
    >
      <p className="text-foreground text-sm font-medium">{kind}</p>
      {busy ? (
        <div className="w-full max-w-xs" aria-live="polite">
          <div className="text-teal-deep flex items-center justify-center gap-2 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {progress === "checking"
              ? t.clinics.dropChecking
              : format(t.clinics.dropUploading, { pct: Math.round(progress) })}
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress === "checking" ? 100 : Math.round(progress)}
            className="bg-border/60 mt-2 h-1.5 overflow-hidden rounded-full"
          >
            <div
              className="bg-teal-deep h-full rounded-full transition-[width] duration-200"
              style={{ width: `${progress === "checking" ? 100 : progress}%` }}
            />
          </div>
        </div>
      ) : (
        <>
          <FileUp className="h-6 w-6" />
          <span className="text-xs">{dragging ? t.clinics.dropRelease : t.clinics.dropPrompt}</span>
        </>
      )}
      <input
        type="file"
        accept={DOC_ACCEPT_ATTRIBUTE}
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
        className="sr-only"
      />
    </label>
  );
}
