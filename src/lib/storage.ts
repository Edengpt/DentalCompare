import { REQUEST_LIMITS } from "./constants";

export type UploadKind = "treatment" | "xray";

export const UPLOAD_KIND_LABELS: Record<UploadKind, string> = {
  treatment: "תוכנית טיפול",
  xray: "צילומי שיניים",
};

export const ACCEPTED_MIME_TYPES = REQUEST_LIMITS.allowedFileTypes;
export const MAX_FILE_SIZE_BYTES = REQUEST_LIMITS.maxFileSizeMB * 1024 * 1024;

export const ACCEPT_ATTRIBUTE = ".pdf,.jpg,.jpeg,.png";

export type FileValidationError = "TYPE" | "SIZE";

export function validateFile(file: File): FileValidationError | null {
  if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
    return "TYPE";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "SIZE";
  }
  return null;
}

export function fileValidationMessage(err: FileValidationError): string {
  switch (err) {
    case "TYPE":
      return "סוג קובץ לא נתמך. אנא העלו PDF, JPG או PNG בלבד.";
    case "SIZE":
      return `הקובץ גדול מדי. המגבלה היא ${REQUEST_LIMITS.maxFileSizeMB}MB.`;
  }
}

export function fileExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["pdf", "jpg", "jpeg", "png"].includes(fromName)) return fromName;
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  return "bin";
}

export function blobPath(requestId: string, kind: UploadKind, file: File): string {
  const ext = fileExtension(file);
  return `requests/${requestId}/${kind}.${ext}`;
}
