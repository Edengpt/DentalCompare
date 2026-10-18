/**
 * Which Vercel Blob hosts count as ours.
 *
 * Every blob URL in this app arrives as a string the browser sent back after a
 * direct upload. Matching only `*.blob.vercel-storage.com` accepts ANY Vercel
 * Blob store — including one an attacker owns, where they can host `text/html`
 * and have our own routes stream it from our domain. So a URL must name OUR
 * store: a blob host is `<storeId>.<access>.blob.vercel-storage.com`, and the
 * store id is the fourth `_` segment of the store's read-write token
 * (`vercel_blob_rw_<storeId>_<secret>`), compared without case.
 *
 * Without the token (local dev, unit tests, the browser bundle) there is
 * nothing to pin to, so any Vercel Blob host passes, as before. Production
 * always has both tokens — `assertEnv` refuses to start without them.
 */

export type BlobStore = "private" | "public";

const TOKEN_VAR: Record<BlobStore, string> = {
  // Medical files, licence documents and quote attachments.
  private: "BLOB_READ_WRITE_TOKEN",
  // Clinic logos.
  public: "LOGO_BLOB_READ_WRITE_TOKEN",
};

const VERCEL_BLOB_HOST = /^([a-z0-9-]+)\.(?:[a-z0-9-]+\.)?blob\.vercel-storage\.com$/i;

export function storeIdFromToken(token: string | undefined): string | null {
  const id = token?.split("_")[3];
  return id ? id.toLowerCase() : null;
}

export function isOwnBlobHost(
  hostname: string,
  store: BlobStore,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const match = VERCEL_BLOB_HOST.exec(hostname);
  if (!match) return false;
  const expected = storeIdFromToken(env[TOKEN_VAR[store]]);
  return expected === null || match[1].toLowerCase() === expected;
}

/** An https URL on our own store of the given kind, or false. */
export function isOwnBlobUrl(
  url: string,
  store: BlobStore,
  env: Record<string, string | undefined> = process.env,
): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && isOwnBlobHost(parsed.hostname, store, env);
  } catch {
    return false;
  }
}
