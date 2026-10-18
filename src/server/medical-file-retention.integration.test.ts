import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type {
  purgeExpiredMedicalFiles as PurgeFn,
  requestsDueForPurge as DueFn,
} from "@/server/medical-file-retention";

const h = vi.hoisted(() => ({ deleted: [] as string[] }));

vi.mock("@vercel/blob", () => ({
  list: async () => ({ blobs: [], hasMore: false }),
  del: async (url: string) => {
    h.deleted.push(url);
  },
}));

const hasDb = Boolean(process.env.DATABASE_URL);

let db: typeof Db;
let purgeExpiredMedicalFiles: typeof PurgeFn;
let requestsDueForPurge: typeof DueFn;

const DAY = 24 * 60 * 60 * 1000;
// Real time, not a far-future one: against a future "now" every row other
// suites leave in the shared database would look expired, crowd these out of
// the batch, and have its files "deleted" by the live-run test.
const NOW = new Date();
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

const createdUsers: string[] = [];

async function seed(data: {
  status: "DRAFT" | "SENT" | "FAILED";
  sentAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
  filesPurgedAt?: Date;
}) {
  const sfx = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: { clerkUserId: `ret_${sfx}`, fullName: "R", email: `ret_${sfx}@example.com` },
  });
  createdUsers.push(user.id);
  return db.request.create({
    data: {
      userId: user.id,
      treatmentFileUrl: `https://blob/t_${sfx}`,
      xrayFileUrl: `https://blob/x_${sfx}`,
      updatedAt: data.updatedAt ?? data.createdAt,
      ...data,
    },
  });
}

describe.skipIf(!hasDb)("medical file retention", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ purgeExpiredMedicalFiles, requestsDueForPurge } =
      await import("@/server/medical-file-retention"));
  });

  afterEach(async () => {
    await db.request.deleteMany({ where: { userId: { in: createdUsers } } });
    await db.user.deleteMany({ where: { id: { in: createdUsers } } });
    createdUsers.length = 0;
    h.deleted.length = 0;
  });

  it("picks sent requests past 30 days and idle drafts past 7, and nothing else", async () => {
    const sentOld = await seed({ status: "SENT", sentAt: daysAgo(31), createdAt: daysAgo(40) });
    const sentRecent = await seed({ status: "SENT", sentAt: daysAgo(5), createdAt: daysAgo(40) });
    const failedOld = await seed({ status: "FAILED", createdAt: daysAgo(31) });
    const draftIdle = await seed({ status: "DRAFT", createdAt: daysAgo(8) });
    const draftActive = await seed({
      status: "DRAFT",
      createdAt: daysAgo(30),
      updatedAt: daysAgo(2),
    });
    const alreadyPurged = await seed({
      status: "SENT",
      sentAt: daysAgo(60),
      createdAt: daysAgo(60),
      filesPurgedAt: daysAgo(29),
    });

    const due = await requestsDueForPurge(NOW);

    expect(due).toEqual(expect.arrayContaining([sentOld.id, failedOld.id, draftIdle.id]));
    for (const r of [sentRecent, draftActive, alreadyPurged]) expect(due).not.toContain(r.id);
  });

  // The first live run catches up on everything since launch, so it must be
  // possible to see its size before anything is deleted.
  it("a dry run counts the files and deletes none", async () => {
    const old = await seed({ status: "SENT", sentAt: daysAgo(31), createdAt: daysAgo(40) });

    const result = await purgeExpiredMedicalFiles({ now: NOW, dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.files).toBeGreaterThanOrEqual(2);
    expect(result.purged).toBe(0);
    expect(h.deleted).toHaveLength(0);
    const row = await db.request.findUnique({ where: { id: old.id } });
    expect(row?.filesPurgedAt).toBeNull();
  });

  it("a live run deletes the files, empties the request and stamps it", async () => {
    const old = await seed({ status: "SENT", sentAt: daysAgo(31), createdAt: daysAgo(40) });

    await purgeExpiredMedicalFiles({ now: NOW, dryRun: false });

    expect(h.deleted).toEqual(expect.arrayContaining([old.treatmentFileUrl, old.xrayFileUrl]));
    const row = await db.request.findUnique({ where: { id: old.id } });
    expect(row).toMatchObject({ treatmentFileUrl: "", xrayFileUrl: "" });
    expect(row?.filesPurgedAt).not.toBeNull();
    // Stamped, so tomorrow's run leaves it alone.
    expect(await requestsDueForPurge(NOW)).not.toContain(old.id);
  });
});
