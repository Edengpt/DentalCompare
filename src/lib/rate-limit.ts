import "server-only";
import { db } from "@/lib/db";

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number };

/**
 * DB-backed fixed-window rate limiter (no external dependency, per PRD §12).
 * Counts hits for `bucket` in the trailing window; if under `limit`, records a
 * hit and allows. Expired hits for the bucket are pruned opportunistically so the
 * table doesn't grow unbounded.
 *
 * Fails OPEN: if the limiter's own DB calls error, legitimate traffic is allowed
 * rather than blocked (the limiter is a best-effort guard, not a hard gate).
 */
export async function rateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(now - windowMs);
  try {
    await db.rateLimit.deleteMany({ where: { bucket, createdAt: { lt: windowStart } } });
    const count = await db.rateLimit.count({
      where: { bucket, createdAt: { gte: windowStart } },
    });
    if (count >= limit) {
      const oldest = await db.rateLimit.findFirst({
        where: { bucket, createdAt: { gte: windowStart } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      const retryAfterMs = oldest ? oldest.createdAt.getTime() + windowMs - now : windowMs;
      return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
    }
    await db.rateLimit.create({ data: { bucket } });
    return { allowed: true };
  } catch (err) {
    console.error("rateLimit error (failing open):", err);
    return { allowed: true };
  }
}
