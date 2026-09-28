import { upload } from "@vercel/blob/client";
import { clinicDocumentBlobPath } from "./clinic-documents";

/**
 * `message` is a server message worth showing verbatim. It is null when the
 * failure came from the upload SDK, which discards our token route's response
 * body and raises a fixed English string of its own — the caller should show
 * its own translated text rather than that.
 */
export type ClinicDocumentUploadResult =
  { ok: true; url: string } | { ok: false; message: string | null };

/**
 * Uploads a licence document straight to storage, then has the server confirm
 * it.
 *
 * Shared by the public registration form, the emailed replacement form and the
 * admin form, because the two-step shape is easy to get subtly wrong: a file
 * that is uploaded but never confirmed has not been checked, and must not be
 * shown to the clinic as accepted.
 */
export async function uploadClinicDocument(
  file: File,
  /** 0-100 while the bytes travel. 100 is not "accepted" — the check follows. */
  onProgress?: (percentage: number) => void,
): Promise<ClinicDocumentUploadResult> {
  let url: string;
  try {
    const blob = await upload(clinicDocumentBlobPath(file), file, {
      // Private, like the patients' medical files and unlike the clinic logos.
      // A licence stored public would be readable by anyone holding the URL,
      // which would make the admin-only download route pointless.
      access: "private",
      handleUploadUrl: "/api/clinics/documents/token",
      onUploadProgress: onProgress ? (e) => onProgress(e.percentage) : undefined,
    });
    url = blob.url;
  } catch {
    return { ok: false, message: null };
  }

  // The file is in storage but nothing may point at it until the server has
  // read its bytes back and agreed they match the type it was stored under.
  try {
    const res = await fetch("/api/clinics/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!res.ok || !data?.url) return { ok: false, message: data?.error ?? null };
    return { ok: true, url: data.url };
  } catch {
    return { ok: false, message: null };
  }
}
