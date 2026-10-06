import type { FileValidationError } from "./storage";
import { requestBlobDir } from "./storage";
import { QUOTE_LIMITS } from "./quote-catalog";

/**
 * Documents a clinic attaches to its quote: a treatment plan PDF, an x-ray, a
 * photo. Medical, so they live in the private store under the request's own
 * folder, next to the patient's files — one prefix holds everything a request
 * owns.
 *
 * Client-safe: no database or server imports.
 */
export const QUOTE_ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const QUOTE_ATTACHMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png";
export const QUOTE_ATTACHMENT_MAX_BYTES = QUOTE_LIMITS.attachmentMaxMB * 1024 * 1024;
export const ATTACHMENT_NAME_MAX = 120;

export type QuoteAttachmentInfo = {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
};

export function validateQuoteAttachment(file: {
  type: string;
  size: number;
}): FileValidationError | null {
  if (!QUOTE_ATTACHMENT_TYPES.includes(file.type as (typeof QUOTE_ATTACHMENT_TYPES)[number])) {
    return "TYPE";
  }
  if (file.size > QUOTE_ATTACHMENT_MAX_BYTES) return "SIZE";
  return null;
}

/** This clinic's attachment folder on this request, with its trailing slash. */
export function quoteAttachmentDir(requestId: string, requestDentistId: string): string {
  return `${requestBlobDir(requestId)}quote-attachments/${requestDentistId}/`;
}

function attachmentExtension(type: string): string {
  if (type === "application/pdf") return "pdf";
  if (type === "image/png") return "png";
  return "jpg";
}

/**
 * A fresh path for one upload. The name is a UUID, never the clinic's file
 * name — that is display data (originalName), and letting it into the path
 * would let it into the path check.
 */
export function quoteAttachmentBlobPath(
  requestId: string,
  requestDentistId: string,
  file: { type: string },
): string {
  return `${quoteAttachmentDir(requestId, requestDentistId)}${crypto.randomUUID()}.${attachmentExtension(file.type)}`;
}

/**
 * Whether a pathname is one this clinic may write for this request.
 *
 * The browser names the upload, so this is the only thing standing between a
 * quote token and every other folder in the store. The name must be a plain
 * file (no slash, so no `../`) of the shape quoteAttachmentBlobPath produces,
 * allowing for the random suffix the store appends.
 */
export function isQuoteAttachmentBlobPath(
  pathname: string,
  requestId: string,
  requestDentistId: string,
): boolean {
  const dir = quoteAttachmentDir(requestId, requestDentistId);
  if (!pathname.startsWith(dir)) return false;
  const name = pathname.slice(dir.length);
  return /^[A-Za-z0-9-]+\.(pdf|jpg|png)$/.test(name);
}

/**
 * The clinic's file name, made safe to store and show: no path, no control
 * characters or quotes, bounded length with the extension kept. Falls back to
 * a generic name rather than an empty string.
 */
export function sanitizeAttachmentName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim();
  if (!clean) return "document";
  if (clean.length <= ATTACHMENT_NAME_MAX) return clean;
  const dot = clean.lastIndexOf(".");
  const ext = dot > 0 && clean.length - dot <= 6 ? clean.slice(dot) : "";
  return clean.slice(0, ATTACHMENT_NAME_MAX - ext.length) + ext;
}

/**
 * A `Content-Disposition` that survives a Hebrew or Russian file name: an
 * ASCII fallback for old clients plus the RFC 5987 UTF-8 form modern browsers
 * prefer.
 */
export function contentDisposition(kind: "inline" | "attachment", name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
