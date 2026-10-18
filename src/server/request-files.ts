import "server-only";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { requestBlobDir } from "@/lib/storage";
import { blobUrlsUnder } from "./blob-sweep";

/**
 * Every stored object that belongs to a request: the patient's treatment plan
 * and x-ray, the documents clinics attached to their quotes, and whatever else
 * sits in the request's folder without a row pointing at it (an upload whose
 * confirm step never ran, or a file the patient since replaced).
 *
 * Throws if the store can't be listed — callers treat that as a failed delete.
 */
export async function requestBlobUrls(requestId: string): Promise<string[]> {
  const request = await db.request.findUnique({
    where: { id: requestId },
    select: {
      treatmentFileUrl: true,
      xrayFileUrl: true,
      requestDentists: { select: { attachments: { select: { blobUrl: true } } } },
    },
  });
  if (!request) return [];
  const quoteFiles = request.requestDentists.flatMap((rd) => rd.attachments.map((a) => a.blobUrl));
  const swept = await blobUrlsUnder(requestBlobDir(requestId));
  return [
    ...new Set(
      [request.treatmentFileUrl, request.xrayFileUrl, ...quoteFiles, ...swept].filter(
        (u): u is string => Boolean(u),
      ),
    ),
  ];
}

/**
 * Deletes the given objects, stopping at the first failure. A deletion that
 * half happened must be reported as a failure the caller can retry, never as
 * success.
 */
export async function deleteBlobs(urls: string[]): Promise<void> {
  for (const url of urls) await del(url);
}

/**
 * Removes a request's medical files and keeps the request itself.
 *
 * For when the record has to outlive its files: the patient deleted their
 * account (the request stays as a detached audit record) or the files reached
 * the end of their retention period. Afterwards the request reads as having no
 * files — the same empty string a fresh draft carries.
 *
 * **Files first, rows second**, as in deleteRequest: if the store fails the
 * rows still point at the files, and the next attempt finds them again.
 */
export async function purgeRequestFiles(requestId: string): Promise<number> {
  const urls = await requestBlobUrls(requestId);
  await deleteBlobs(urls);
  await db.$transaction([
    db.quoteAttachment.deleteMany({ where: { requestDentist: { requestId } } }),
    db.request.update({
      where: { id: requestId },
      data: { treatmentFileUrl: "", xrayFileUrl: "", filesPurgedAt: new Date() },
    }),
  ]);
  return urls.length;
}

/**
 * Strips a patient's requests of their medical content when the account is
 * deleted: every file is removed (purgeRequestFiles) and the free-text notes,
 * which can describe the patient's condition just as well, are cleared.
 *
 * The request rows themselves stay, detached from the user (onDelete: SetNull),
 * as the audit record they always were. What they no longer hold is anything
 * about the patient's mouth.
 *
 * Throws on the first failure so the webhook answers 500 and Clerk retries —
 * the user row must not go before its files do, or nothing would ever point at
 * them again.
 */
export async function purgeUserMedicalData(clerkUserId: string): Promise<number> {
  const requests = await db.request.findMany({
    where: { user: { clerkUserId } },
    select: { id: true },
  });
  let removed = 0;
  for (const r of requests) {
    removed += await purgeRequestFiles(r.id);
    await db.request.update({ where: { id: r.id }, data: { patientNotes: null } });
  }
  return removed;
}
