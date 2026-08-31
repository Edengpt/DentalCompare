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

/** How many leading bytes headMatchesType needs to decide. */
export const SIGNATURE_BYTES = 8;

/**
 * Whether these leading "magic" bytes really belong to the declared MIME type.
 *
 * A browser-supplied type or extension can be spoofed by renaming a file, so
 * validateFile() alone is not enough for anything the public can send.
 *
 * Split out from fileSignatureMatches because the browser now uploads straight
 * to storage: the bytes never pass through a route on the way in, and the only
 * place left to check them is a short read back out of the stored blob. Both
 * callers have to apply the same rule, so the rule lives in one place.
 */
export function headMatchesType(head: Uint8Array, contentType: string): boolean {
  // A short read is an unknown file, not a matching one.
  const startsWith = (sig: number[]) =>
    head.length >= sig.length && sig.every((b, i) => head[i] === b);
  switch (contentType) {
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

/** headMatchesType for a File we are still holding. */
export async function fileSignatureMatches(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, SIGNATURE_BYTES).arrayBuffer());
  return headMatchesType(head, file.type);
}

export function fileExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["pdf", "jpg", "jpeg", "png"].includes(fromName)) return fromName;
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  return "bin";
}

/** The folder this request's files live in, with its trailing slash. */
export function requestBlobDir(requestId: string): string {
  return `requests/${requestId}/`;
}

export function blobPath(requestId: string, kind: UploadKind, file: File): string {
  return `${requestBlobDir(requestId)}${kind}.${fileExtension(file)}`;
}

/**
 * Whether a pathname belongs to this request and this kind, and nothing else.
 *
 * The browser chooses the pathname it uploads to, and the token route is the
 * only place that sees it before the write happens. Without this check a
 * patient could write into another patient's folder, or overwrite their own
 * treatment plan with an x-ray.
 *
 * The store appends a random suffix to the name it was given, so the stored
 * file is `xray-Xy7Kq2.jpg` rather than `xray.jpg` — the kind is matched as the
 * name's leading segment rather than the whole of it. The name must still be a
 * plain filename: a slash anywhere in it would let `xray/../../other` through.
 */
export function isOwnRequestBlobPath(
  pathname: string,
  requestId: string,
  kind: UploadKind,
): boolean {
  const dir = requestBlobDir(requestId);
  if (!pathname.startsWith(dir)) return false;
  const name = pathname.slice(dir.length);
  if (!name || name.includes("/")) return false;
  const base = name.split(".")[0];
  return base === kind || base.startsWith(`${kind}-`);
}

// --- Clinic logo upload (public, image-only) ---

export const LOGO_ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/**
 * The largest logo a clinic may upload.
 *
 * Four rather than five, and the ceiling is not ours: Vercel refuses a request
 * body over roughly 4.5MB at the edge, before any route code runs, and answers
 * with plain text instead of JSON. Advertising five meant inviting a clinic to
 * upload a file we had promised to accept and the platform then silently
 * refused — with a phone camera photo landing squarely in that gap.
 *
 * Four leaves room for the multipart envelope, which wraps the bytes in
 * boundaries and headers and makes the request larger than the file.
 */
export const LOGO_MAX_FILE_SIZE_MB = 4;
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
