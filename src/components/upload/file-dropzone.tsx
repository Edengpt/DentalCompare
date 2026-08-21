"use client";

import { useRef, useState } from "react";
import { Check, FileText, Image as ImageIcon, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { fileValidationMessage } from "@/i18n/validation-message";
import { cn } from "@/lib/utils";
import { REQUEST_LIMITS } from "@/lib/constants";
import {
  ACCEPT_ATTRIBUTE,
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

  const handleFile = (file: File) => {
    const err = validateFile(file);
    if (err) {
      toast.error(fileValidationMessage(t.validation, err));
      return;
    }

    setState({ status: "uploading", progress: 0, fileName: file.name, fileSize: file.size });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("requestId", requestId);
    formData.append("kind", kind);

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        setState({
          status: "uploading",
          progress: Math.round((e.loaded / e.total) * 100),
          fileName: file.name,
          fileSize: file.size,
        });
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const json = JSON.parse(xhr.responseText);
        setState({
          status: "done",
          url: json.url,
          fileName: file.name,
          fileSize: file.size,
        });
        onUploaded(json.url);
        toast.success(t.dropzone.uploadSuccess(kindLabel));
      } else {
        let message = t.dropzone.uploadFailed;
        try {
          message = JSON.parse(xhr.responseText).error ?? message;
        } catch {
          /* swallow parse error */
        }
        toast.error(message);
        setState({ status: "idle" });
      }
    });
    xhr.addEventListener("error", () => {
      toast.error(t.dropzone.networkError);
      setState({ status: "idle" });
    });
    xhr.open("POST", "/api/files/upload");
    xhr.send(formData);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
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
        "border-border/60 bg-card/50 rounded-3xl border-2 border-dashed p-8 text-center transition-all",
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
          if (file) handleFile(file);
        }}
      />

      {state.status === "idle" && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-3 outline-none"
        >
          <span className="bg-teal-deep/10 text-teal-deep inline-flex h-12 w-12 items-center justify-center rounded-2xl">
            <UploadCloud className="h-5 w-5" />
          </span>
          <div>
            <p className="text-foreground font-semibold">
              {t.dropzone.dragHere} <span className="text-teal-deep underline">{t.dropzone.chooseFile}</span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">{description}</p>
            <p className="text-muted-foreground/70 mt-3 text-[11px]">
              {t.dropzone.fileHint(REQUEST_LIMITS.maxFileSizeMB)}
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
            <p className="text-foreground font-semibold">{t.dropzone.uploaded(kindLabel)}</p>
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
