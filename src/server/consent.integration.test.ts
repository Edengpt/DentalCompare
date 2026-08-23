import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { recordConsent as RecordFn } from "@/server/consent-actions";
import { PATIENT_CONSENT_VERSION } from "@/lib/constants";

const h = vi.hoisted(() => ({ clerkUserId: { value: "" } }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.clerkUserId.value }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const hasDb = Boolean(process.env.DATABASE_URL);

// Imported lazily (only when a DB is configured) so the suite stays safe — and
// db.ts doesn't throw at import time — in environments without DATABASE_URL.
let db: typeof Db;
let recordConsent: typeof RecordFn;

const createdUsers: string[] = [];

async function seedRequest() {
  const sfx = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: { clerkUserId: `consent_${sfx}`, fullName: "C", email: `c_${sfx}@example.com` },
  });
  createdUsers.push(user.id);
  h.clerkUserId.value = user.clerkUserId;
  return db.request.create({
    data: { userId: user.id, treatmentFileUrl: "https://b/t", xrayFileUrl: "https://b/x" },
  });
}

describe.skipIf(!hasDb)("recordConsent", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ recordConsent } = await import("@/server/consent-actions"));
  });

  afterEach(async () => {
    await db.user.deleteMany({ where: { id: { in: createdUsers } } });
    createdUsers.length = 0;
  });

  it("stores when consent was given and to which wording", async () => {
    const request = await seedRequest();

    expect(await recordConsent(request.id)).toEqual({ ok: true });

    const after = await db.request.findUnique({ where: { id: request.id } });
    expect(after?.consentAt).toBeInstanceOf(Date);
    expect(after?.consentVersion).toBe(PATIENT_CONSENT_VERSION);
  });

  // Consent belongs to the wording it was given to and the moment it was given.
  // Rewriting either is what would make it unprovable.
  it("does not overwrite consent already given to older wording", async () => {
    const request = await seedRequest();
    await db.request.update({
      where: { id: request.id },
      data: { consentAt: new Date("2020-01-01"), consentVersion: "wording-from-2020" },
    });

    expect(await recordConsent(request.id)).toEqual({ ok: true });

    const after = await db.request.findUnique({ where: { id: request.id } });
    expect(after?.consentVersion).toBe("wording-from-2020");
    expect(after?.consentAt?.getFullYear()).toBe(2020);
  });

  it("does not record consent on another user's request", async () => {
    const request = await seedRequest();
    h.clerkUserId.value = "someone_else_entirely";

    expect((await recordConsent(request.id)).ok).toBe(false);

    const after = await db.request.findUnique({ where: { id: request.id } });
    expect(after?.consentAt).toBeNull();
  });

  it("reports a request that isn't there", async () => {
    await seedRequest();
    expect((await recordConsent(randomUUID())).ok).toBe(false);
  });
});
