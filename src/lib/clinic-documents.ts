import type { FileValidationError } from "./storage";

/**
 * Licence documents a clinic must hand over before it can be listed.
 *
 * The rule lives here rather than separately in the form, the registration
 * action and the admin action: all three ask "which documents does this country
 * require, and which are missing", and a third answer that drifted would be a
 * hole in the promise that every listed clinic has had its licence seen.
 */

/**
 * Used when a country lists no documents of its own.
 *
 * A country is a row an admin fills in, and a half-filled row must not turn
 * into a country with no check. "Mandatory" has to be true everywhere or it is
 * true nowhere.
 */
export const GENERIC_DOC_KIND = "licence";

/**
 * The ceiling is not ours. Vercel refuses a request body over roughly 4.5MB at
 * the edge, before any route code runs, and answers with plain text rather than
 * JSON — so a larger limit would be a promise the platform silently breaks.
 * See LOGO_MAX_FILE_SIZE_MB in ./storage for the same ceiling and the same
 * reasoning. A phone photo of a framed licence lands well inside it.
 */
export const DOC_MAX_FILE_SIZE_MB = 4;
export const DOC_MAX_FILE_SIZE_BYTES = DOC_MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * A photo from a phone is the primary path, not a concession: a clinic can
 * photograph the licence hanging on its wall in ten seconds, where finding a
 * scan means abandoning the form and probably not coming back.
 */
export const DOC_ACCEPTED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export const DOC_ACCEPT_ATTRIBUTE = ".pdf,.jpg,.jpeg,.png";

/** Which documents this country asks for. Never an empty list. */
export function requiredDocKinds(requiredDocs: string[]): string[] {
  const unique = [...new Set(requiredDocs.map((d) => d.trim()).filter(Boolean))];
  return unique.length > 0 ? unique : [GENERIC_DOC_KIND];
}

/** Required kinds with nothing uploaded against them, in the order asked for. */
export function missingDocKinds(required: string[], provided: string[]): string[] {
  const have = new Set(provided);
  return required.filter((kind) => !have.has(kind));
}

export function validateClinicDocument(file: File): FileValidationError | null {
  if (!DOC_ACCEPTED_MIME_TYPES.includes(file.type as (typeof DOC_ACCEPTED_MIME_TYPES)[number])) {
    return "TYPE";
  }
  if (file.size > DOC_MAX_FILE_SIZE_BYTES) return "SIZE";
  return null;
}

function docExtension(file: File): string {
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  return "jpg";
}

const DOC_PREFIX = "clinics/documents/";

/** Unique per upload, so two clinics uploading "licence.pdf" never collide. */
export function clinicDocumentBlobPath(file: File): string {
  return `${DOC_PREFIX}${crypto.randomUUID()}.${docExtension(file)}`;
}

/**
 * Whether a URL is one our own document-upload route produced.
 *
 * The registration form submits these as plain strings, so without this check a
 * clinic could name any file on the internet as its licence — or point at
 * another clinic's private medical file and have an admin open it.
 */
export function isClinicDocumentBlobUrl(url: string): boolean {
  return new RegExp(`^https://[a-z0-9.-]*\.blob\.vercel-storage\.com/${DOC_PREFIX}`, "i").test(
    url,
  );
}
