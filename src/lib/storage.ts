import { REQUEST_LIMITS } from "./constants";

export type UploadKind = "treatment" | "xray";

// The Hebrew label map that lived here moved into the dictionaries — a display
// label can't sit in a storage module once the site is bilingual. Use
// t.upload.treatmentPlanTitle / t.upload.xrayTitle at the call site.

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

// fileValidationMessage / logoValidationMessage used to live here, returning
// Hebrew strings. A validator in a storage module can't own display copy once
// the site is bilingual — the codes it returns ("TYPE" / "SIZE") are the API,
// and t.validation.* turns them into text at the call site.

/**
 * Verifies the file's leading "magic" bytes match its declared MIME type. The
 * browser-supplied `file.type`/extension can be spoofed by simply renaming a
 * file, so validateFile() alone isn't enough for uploads that come straight from
 * the public. Returns true only when the real content matches one of the allowed
 * types. Async because it reads the first bytes of the blob.
 */
export async function fileSignatureMatches(file: File): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const startsWith = (sig: number[]) => sig.every((b, i) => header[i] === b);
  switch (file.type) {
    case "application/pdf":
      return startsWith([0x25, 0x50, 0x44, 0x46]); // "%PDF"
    case "image/png":
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return startsWith([0xff, 0xd8, 0xff]);
    default:
      return false;
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

// --- Clinic logo upload (public, image-only) ---

export const LOGO_ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const LOGO_MAX_FILE_SIZE_MB = 5;
export const LOGO_MAX_FILE_SIZE_BYTES = LOGO_MAX_FILE_SIZE_MB * 1024 * 1024;
export const LOGO_ACCEPT_ATTRIBUTE = ".jpg,.jpeg,.png,.webp";

export function validateLogo(file: File): FileValidationError | null {
  if (!LOGO_ACCEPTED_MIME_TYPES.includes(file.type as (typeof LOGO_ACCEPTED_MIME_TYPES)[number])) {
    return "TYPE";
  }
  if (file.size > LOGO_MAX_FILE_SIZE_BYTES) {
    return "SIZE";
  }
  return null;
}


function logoExtension(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function logoBlobPath(file: File): string {
  // Unique per upload so paths never collide (previously every logo shared
  // "clinics/logos/logo.<ext>" and only survived via the blob's addRandomSuffix).
  return `clinics/logos/${crypto.randomUUID()}.${logoExtension(file)}`;
}
