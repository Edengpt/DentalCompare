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
 * This used to be 4MB, and the 4 was not ours: the document travelled through a
 * route, which meant it travelled through Vercel's edge, and the edge refuses a
 * request body over roughly 4.5MB before any route code runs. The limit was set
 * below the ceiling so the site would not promise what the platform breaks.
 *
 * The upload now goes from the browser straight to storage, so the ceiling is
 * gone and the number can be about licences instead of about infrastructure. A
 * phone photo of a framed licence is routinely 5-8MB on a recent handset, which
 * is exactly the file the 4MB limit was turning away.
 */
export const DOC_MAX_FILE_SIZE_MB = 20;
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

export const DOC_PREFIX = "clinics/documents/";

/** Unique per upload, so two clinics uploading "licence.pdf" never collide. */
export function clinicDocumentBlobPath(file: File): string {
  return `${DOC_PREFIX}${crypto.randomUUID()}.${docExtension(file)}`;
}

/**
 * Whether a pathname is one a document upload may write to.
 *
 * The browser now names the file it uploads, and this route is unauthenticated
 * — the registration form is public, and the document exists before the clinic
 * row does. So this is the only thing standing between a stranger and a chosen
 * write path into the private store that also holds patients' x-rays. The name
 * must sit directly in the documents folder: a slash in it would let
 * `..%2F..%2Frequests` climb out.
 */
export function isClinicDocumentBlobPath(pathname: string): boolean {
  if (!pathname.startsWith(DOC_PREFIX)) return false;
  const name = pathname.slice(DOC_PREFIX.length);
  return name.length > 0 && !name.includes("/");
}

/**
 * Whether a URL is one our own document-upload route produced.
 *
 * The registration form submits these as plain strings, so without this check a
 * clinic could name any file on the internet as its licence — or point at
 * another clinic's private medical file and have an admin open it.
 */
export function isClinicDocumentBlobUrl(url: string): boolean {
  // Built by hand rather than with a template literal: inside one, `\.` is just
  // `.` again by the time RegExp sees it, and the dots would match any
  // character — `xblobyvercel-storagezcom` would pass.
  const host = String.raw`[a-z0-9.-]*\.blob\.vercel-storage\.com`;
  return new RegExp(`^https://${host}/${DOC_PREFIX}`, "i").test(url);
}

/**
 * How long a replacement-upload link stays usable.
 *
 * The payment-setup token deliberately never expires; this one does. That token
 * opens a page at an external provider, this one opens a write path into our own
 * private storage — and it travels by email, where it outlives the conversation
 * that produced it. Two weeks is long enough for a clinic that has to go and
 * photograph something, short enough that a forwarded mailbox is not a standing
 * key. An admin can always issue a new one.
 */
export const DOCUMENT_TOKEN_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export function documentTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + DOCUMENT_TOKEN_DAYS * DAY_MS);
}

/** Null means no token was ever issued, which is not the same as a live one. */
export function isDocumentTokenLive(expiresAt: Date | null, now: Date): boolean {
  if (!expiresAt) return false;
  return now.getTime() < expiresAt.getTime();
}
