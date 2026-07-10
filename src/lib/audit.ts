import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Fire-and-forget audit trail (PRD §12). A failed audit write must never break
 * the business action that triggered it, so errors are swallowed and logged.
 */
export async function audit(entry: {
  actor: string; // admin email, or "system" / "webhook" for automated actors
  action: string;
  entity: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actor: entry.actor,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        metadata: entry.metadata,
      },
    });
  } catch (err) {
    console.error("audit write failed:", err);
  }
}
