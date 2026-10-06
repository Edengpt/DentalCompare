import { upload } from "@vercel/blob/client";
import { quoteAttachmentBlobPath, type QuoteAttachmentInfo } from "./quote-attachments";

/**
 * `message` is a server message worth showing verbatim, or null when the
 * failure came from the upload SDK (which discards our response body) — the
 * caller then shows its own translated text.
 */
export type QuoteAttachmentUploadResult =
  { ok: true; attachment: QuoteAttachmentInfo } | { ok: false; message: string | null };

/**
 * Uploads a quote document straight to the private store, then has the server
 * confirm it. Same two-step shape as uploadClinicDocument: a file that is
 * uploaded but not confirmed has not been checked and must not be shown to the
 * clinic as attached.
 */
export async function uploadQuoteAttachment(
  file: File,
  target: { token: string; requestId: string; requestDentistId: string },
  onProgress?: (percentage: number) => void,
): Promise<QuoteAttachmentUploadResult> {
  let url: string;
  try {
    const blob = await upload(
      quoteAttachmentBlobPath(target.requestId, target.requestDentistId, file),
      file,
      {
        access: "private",
        handleUploadUrl: "/api/quote-attachments/token",
        clientPayload: JSON.stringify({ token: target.token }),
        onUploadProgress: onProgress ? (e) => onProgress(e.percentage) : undefined,
      },
    );
    url = blob.url;
  } catch {
    return { ok: false, message: null };
  }

  try {
    const res = await fetch("/api/quote-attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: target.token, url, name: file.name }),
    });
    const data = (await res.json().catch(() => null)) as {
      attachment?: QuoteAttachmentInfo;
      error?: string;
    } | null;
    if (!res.ok || !data?.attachment) return { ok: false, message: data?.error ?? null };
    return { ok: true, attachment: data.attachment };
  } catch {
    return { ok: false, message: null };
  }
}

export async function removeQuoteAttachment(id: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/quote-attachments/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
