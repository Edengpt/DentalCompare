import "server-only";
import { list } from "@vercel/blob";

/**
 * Every stored object under a folder, whether or not a row points at it.
 *
 * Deleting by row misses uploads that never got one: a clinic whose tab closed
 * between the upload and the confirm step leaves a medical file in the
 * request's folder that nothing references. Sweeping the folder is the only
 * way those are ever removed. Throws if the store can't be listed — callers
 * treat that like a failed delete and stop.
 */
export async function blobUrlsUnder(prefix: string): Promise<string[]> {
  const urls: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    urls.push(...page.blobs.map((b) => b.url));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return urls;
}
