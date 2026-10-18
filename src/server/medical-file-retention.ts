import "server-only";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { DRAFT_FILE_RETENTION_DAYS, FILE_RETENTION_DAYS } from "@/lib/constants";
import { purgeRequestFiles, requestBlobUrls } from "./request-files";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Most requests one run handles, so a backlog can't outlast the function. */
const BATCH = 200;

export type RetentionResult = {
  dryRun: boolean;
  /** Requests whose files are past their retention period in this batch. */
  due: number;
  /** Stored objects those requests hold — what a live run deletes. */
  files: number;
  purged: number;
  failed: number;
};

/**
 * Requests whose medical files have outlived their purpose:
 * - sent ones, FILE_RETENTION_DAYS after they went out to clinics (or after
 *   creation, for one that failed before it was ever sent);
 * - drafts nobody touched for DRAFT_FILE_RETENTION_DAYS.
 *
 * Oldest first, so a backlog drains in order.
 */
export async function requestsDueForPurge(now: Date): Promise<string[]> {
  const sentCutoff = new Date(now.getTime() - FILE_RETENTION_DAYS * DAY_MS);
  const draftCutoff = new Date(now.getTime() - DRAFT_FILE_RETENTION_DAYS * DAY_MS);
  const rows = await db.request.findMany({
    where: {
      filesPurgedAt: null,
      OR: [
        { status: { not: "DRAFT" }, sentAt: { lt: sentCutoff } },
        { status: { not: "DRAFT" }, sentAt: null, createdAt: { lt: sentCutoff } },
        { status: "DRAFT", updatedAt: { lt: draftCutoff } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Deletes the medical files of every request past its retention period.
 *
 * With `dryRun` it only counts — what a live run would delete, and nothing
 * else. The cron runs dry until PURGE_MEDICAL_FILES=on is set, so the first
 * real run (which catches up on every request since launch) happens only after
 * someone has seen those numbers.
 *
 * One request failing does not stop the others; it stays unstamped and the
 * next day's run tries it again.
 */
export async function purgeExpiredMedicalFiles(opts: {
  now?: Date;
  dryRun: boolean;
}): Promise<RetentionResult> {
  const ids = await requestsDueForPurge(opts.now ?? new Date());
  const result: RetentionResult = {
    dryRun: opts.dryRun,
    due: ids.length,
    files: 0,
    purged: 0,
    failed: 0,
  };

  for (const id of ids) {
    try {
      if (opts.dryRun) {
        result.files += (await requestBlobUrls(id)).length;
      } else {
        result.files += await purgeRequestFiles(id);
        result.purged += 1;
      }
    } catch (err) {
      result.failed += 1;
      logEvent("error", "retention.purge_failed", { requestId: id, error: String(err) });
    }
  }

  logEvent("info", "retention.run", result);
  return result;
}
