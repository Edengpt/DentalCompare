import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { audit as AuditFn } from "@/lib/audit";

const hasDb = Boolean(process.env.DATABASE_URL);
const DB_TIMEOUT = 60_000;

let db: typeof Db;
let audit: typeof AuditFn;
const ids: string[] = [];

describe.skipIf(!hasDb)("audit() (integration, real DB)", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ audit } = await import("@/lib/audit"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of ids) await db.auditLog.delete({ where: { id } }).catch(() => {});
    ids.length = 0;
  }, DB_TIMEOUT);

  it(
    "persists an audit row with its metadata",
    async () => {
      const entityId = `itest_${randomUUID().slice(0, 8)}`;
      await audit({
        actor: "itest",
        action: "test.event",
        entity: "Test",
        entityId,
        metadata: { a: 1, note: "hello" },
      });
      const row = await db.auditLog.findFirst({ where: { entity: "Test", entityId } });
      expect(row).not.toBeNull();
      ids.push(row!.id);
      expect(row!.actor).toBe("itest");
      expect(row!.action).toBe("test.event");
      expect(row!.metadata).toEqual({ a: 1, note: "hello" });
    },
    DB_TIMEOUT,
  );
});
