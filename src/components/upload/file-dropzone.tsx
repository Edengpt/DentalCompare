"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Check, FileText, Image as ImageIcon, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { fileValidationMessage } from "@/i18n/validation-message";
import { cn } from "@/lib/utils";
import { REQUEST_LIMITS } from "@/lib/constants";
import {
  ACCEPT_ATTRIBUTE,
  blobPath,
  type UploadKind,
  validateFile,
} from "@/lib/storage";

type FileDropzoneProps = {
  kind: UploadKind;
  requestId: string;
  initialUrl: string | null;
  onUploaded: (url: string) => void;
  description: string;
};

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number; fileName: string; fileSize: number }
  | { status: "done"; url: string; fileName?: string; fileSize?: number };

function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ name }: { name?: string }) {
  const isImage = name?.match(/\.(jpe?g|png|gif|webp)$/i);
  return isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />;
}

export function FileDropzone({
  kind,
  requestId,
  initialUrl,
  onUploaded,
  description,
}: FileDropzoneProps) {
  const t = useT();
  const kindLabel = kind === "treatment" ? t.upload.treatmentPlanTitle : t.upload.xrayTitle;
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>(
    initialUrl ? { status: "done", url: initialUrl } : { status: "idle" },
  );
  const [dragOver, setDragOver] = useState(false);

  /**
   * Uploads straight to storage, then tells the server where the file landed.
   *
   * The file used to be POSTed to /api/files/upload, which meant it passed
   * through Vercel's edge — and the edge rejects a body over roughly 4.5MB
   * before any route code runs, with a plain-text error this component could
   * not read or translate. Since the site offers 20MB, a phone photo of an
   * x-ray failed here with "upload failed" and no way to explain why.
   */
  const handleFile = async (file: File) => {
    const err = validateFile(file);
    if (err) {
      toast.error(fileValidationMessage(t.validation, err));
      return;
    }

    setState({ status: "uploading", progress: 0, fileName: file.name, fileSize: file.size });

    let blob: { url: string; pathname: string };
    try {
      blob = await upload(blobPath(requestId, kind, file), file, {
        // X-rays and treatment plans: readable only through an authenticated
        // fetch, never by anyone who happens to have the URL.
        access: "private",
        handleUploadUrl: "/api/files/upload/token",
        clientPayload: JSON.stringify({ requestId, kind }),
        onUploadProgress: ({ percentage }) => {
          setState({
            status: "uploading",
            progress: Math.round(percentage),
            fileName: file.name,
            fileSize: file.size,
          });
        },
      });
    } catch {
      // Whatever the token route said, the upload SDK throws away the response
      // body and raises a fixed English string of its own. There is no server
      // message to show here, so show ours rather than the library's.
      toast.error(t.dropzone.uploadFailed);
      setState({ status: "idle" });
      return;
    }

    // Separate step: the file exists in storage but is attached to nothing
    // until the server has checked its bytes and recorded the URL. This one is
    // a plain fetch, so its error text does reach the patient.
    try {
      const res = await fetch("/api/files/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          kind,
          url: blob.url,
        }),
      });
      if (!res.ok) {
        const message = await res
          .json()
          .then((j: { error?: string }) => j.error)
          .catch(() => null);
        toast.error(message ?? t.dropzone.uploadFailed);
        setState({ status: "idle" });
        return;
      }
    } catch {
      toast.error(t.dropzone.networkError);
      setState({ status: "idle" });
      return;
    }

    setState({ status: "done", url: blob.url, fileName: file.name, fileSize: file.size });
    onUploaded(blob.url);
    toast.success(format(t.dropzone.uploadSuccess, { label: kindLabel }));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const reset = () => {
    setState({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      className={cn(
        "border-border/60 bg-card/50 rounded-lg border-2 border-dashed p-8 text-center transition-all",
        dragOver && "border-teal-deep/60 bg-teal-deep/5",
        state.status === "done" && "border-teal-deep/40 bg-teal-deep/3 border-solid",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {state.status === "idle" && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-3 outline-none"
        >
          <span className="bg-teal-deep/10 text-teal-deep inline-flex h-12 w-12 items-center justify-center rounded-lg">
            <UploadCloud className="h-5 w-5" />
          </span>
          <div>
            <p className="text-foreground font-semibold">
              {t.dropzone.dragHere} <span className="text-teal-deep underline">{t.dropzone.chooseFile}</span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">{description}</p>
            <p className="text-muted-foreground/70 mt-3 text-[11px]">
              {format(t.dropzone.fileHint, { mb: REQUEST_LIMITS.maxFileSizeMB })}
            </p>
          </div>
        </button>
      )}

      {state.status === "uploading" && (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-teal-deep h-6 w-6 animate-spin" />
          <div className="w-full max-w-xs">
            <div className="text-foreground flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 truncate">
                <FileIcon name={state.fileName} />
                <span className="truncate">{state.fileName}</span>
              </span>
              <span className="text-muted-foreground shrink-0 text-xs">{state.progress}%</span>
            </div>
            <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-teal-deep h-full transition-all"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {state.status === "done" && (
        <div className="flex flex-col items-center gap-3">
          <span className="bg-teal-deep text-cream inline-flex h-10 w-10 items-center justify-center rounded-full">
            <Check className="h-5 w-5" />
          </span>
          <div>
            <p className="text-foreground font-semibold">{format(t.dropzone.uploaded, { label: kindLabel })}</p>
            {state.fileName && (
              <p className="text-muted-foreground mt-1 inline-flex items-center gap-1.5 text-xs">
                <FileIcon name={state.fileName} />
                {state.fileName}
                {state.fileSize ? ` ✦ ${fmtSize(state.fileSize)}` : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={reset}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
          >
            <X className="h-3 w-3" />
            {t.dropzone.replace}
          </button>
        </div>
      )}
    </div>
  );
}
