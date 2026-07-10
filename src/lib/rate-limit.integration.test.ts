import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { rateLimit as RateLimitFn } from "@/lib/rate-limit";

const hasDb = Boolean(process.env.DATABASE_URL);
const DB_TIMEOUT = 60_000;

let db: typeof Db;
let rateLimit: typeof RateLimitFn;
let bucket = "";

describe.skipIf(!hasDb)("rateLimit (integration, real DB)", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ rateLimit } = await import("@/lib/rate-limit"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    if (bucket) await db.rateLimit.deleteMany({ where: { bucket } }).catch(() => {});
    bucket = "";
  }, DB_TIMEOUT);

  it(
    "allows up to the limit within the window, then blocks with a retry hint",
    async () => {
      bucket = `itest:${randomUUID().slice(0, 8)}`;
      const results = [];
      for (let i = 0; i < 4; i++) results.push(await rateLimit(bucket, 3, 60_000));
      expect(results.slice(0, 3).every((r) => r.allowed)).toBe(true);
      expect(results[3].allowed).toBe(false);
      if (!results[3].allowed) expect(results[3].retryAfterMs).toBeGreaterThan(0);
    },
    DB_TIMEOUT,
  );

  it(
    "prunes hits outside the window so stale activity doesn't count",
    async () => {
      bucket = `itest:${randomUUID().slice(0, 8)}`;
      // A hit from 2 minutes ago, outside a 1-minute window.
      await db.rateLimit.create({
        data: { bucket, createdAt: new Date(Date.now() - 2 * 60_000) },
      });
      const r = await rateLimit(bucket, 1, 60_000);
      expect(r.allowed).toBe(true); // the stale hit was pruned, so we're under the limit
    },
    DB_TIMEOUT,
  );
});
