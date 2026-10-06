import "server-only";
import { get } from "@vercel/blob";
import { SIGNATURE_BYTES } from "./storage";

/**
 * Shared by every route that confirms a browser-direct upload: the patient's
 * files, clinic licence documents and quote attachments all arrive as a URL
 * the browser chose, and all three have to check it the same way.
 */

/** The stored pathname a blob URL refers to, or null if it is not one of ours. */
export function blobPathnameOf(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || !/\.blob\.vercel-storage\.com$/i.test(parsed.hostname)) {
    return null;
  }
  return decodeURIComponent(parsed.pathname).slice(1) || null;
}

/**
 * First bytes of a stored private blob, plus the type and size the store has on
 * record, or null when it cannot be read.
 */
export async function readBlobHead(
  url: string,
): Promise<{ head: Uint8Array; contentType: string; size: number } | null> {
  try {
    const result = await get(url, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    const reader = result.stream.getReader();
    const head = new Uint8Array(SIGNATURE_BYTES);
    let filled = 0;
    // Read until the signature is covered rather than trusting one chunk to
    // carry it: a short first chunk would otherwise look like a bad signature
    // and get a real file deleted.
    while (filled < SIGNATURE_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      const take = value.subarray(0, SIGNATURE_BYTES - filled);
      head.set(take, filled);
      filled += take.length;
    }
    // Stop pulling as soon as the head is in hand — the file may be 20MB.
    await reader.cancel().catch(() => {});
    if (filled < SIGNATURE_BYTES) return null;
    return { head, contentType: result.blob.contentType, size: result.blob.size };
  } catch {
    return null;
  }
}
