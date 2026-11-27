import "server-only";
import { del, get, put } from "@vercel/blob";
import { decryptFile, encryptFile, fileEncryptionKey } from "@/lib/file-crypto";
import { logEvent } from "@/lib/log";

/**
 * Replaces a just-uploaded medical file with an encrypted copy and returns the
 * copy's URL — the one to record.
 *
 * The browser still uploads straight to storage (Vercel refuses request bodies
 * over ~4.5MB, so the bytes cannot come through us). The limit is on what comes
 * IN to a function, not on what it reads from storage, so the confirm step can
 * read the file back, encrypt it and write it again. The plaintext exists for
 * the seconds between upload and confirm, then is deleted.
 *
 * Call it only after the file's signature has been checked: from here on the
 * stored bytes are ciphertext and can no longer be sniffed.
 *
 * With no key configured (local dev, CI) the file is left as it is. Production
 * cannot start without one — see env.ts.
 */
export async function sealUploadedFile(
  url: string,
  pathname: string,
  contentType: string,
): Promise<string> {
  const key = fileEncryptionKey();
  if (!key) return url;

  const result = await get(url, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`could not read upload to encrypt (status ${result?.statusCode})`);
  }
  const plain = Buffer.from(await new Response(result.stream).arrayBuffer());

  // Same folder and name, fresh random suffix: the copy still passes every
  // path check the original did, and the two never collide.
  const sealed = await put(pathname, encryptFile(plain, key), {
    access: "private",
    contentType,
    addRandomSuffix: true,
  });

  // If this fails the plaintext stays in the request's folder, where deleting
  // or purging the request sweeps it up. Worth knowing about, not worth
  // failing an upload the patient already sees as done.
  await del(url).catch((err) =>
    logEvent("error", "sealed_files.plaintext_delete_failed", { error: String(err) }),
  );
  return sealed.url;
}

/** A private medical file's plaintext and stored type, or null if unreadable. */
export async function readPrivateFile(
  url: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  const result = await get(url, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const stored = Buffer.from(await new Response(result.stream).arrayBuffer());
  return {
    data: decryptFile(stored),
    contentType: result.blob.contentType || "application/octet-stream",
  };
}
