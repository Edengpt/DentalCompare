import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { deleteRequest as DeleteFn } from "@/server/request-deletion";

const h = vi.hoisted(() => ({
  clerkUserId: { value: "" },
  deleted: [] as string[],
  failFor: new Set<string>(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.clerkUserId.value }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@vercel/blob", () => ({
  del: async (url: string) => {
    if (h.failFor.has(url)) throw new Error("blob store unavailable");
    h.deleted.push(url);
  },
}));

const hasDb = Boolean(process.env.DATABASE_URL);

// Imported lazily (only when a DB is configured) so the suite stays safe — and
// db.ts doesn't throw at import time — in environments without DATABASE_URL.
let db: typeof Db;
let deleteRequest: typeof DeleteFn;

const createdUsers: string[] = [];

async function seedRequest() {
  const sfx = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: { clerkUserId: `del_${sfx}`, fullName: "D", email: `d_${sfx}@example.com` },
  });
  createdUsers.push(user.id);
  h.clerkUserId.value = user.clerkUserId;
  return db.request.create({
    data: {
      userId: user.id,
      treatmentFileUrl: `https://blob/treatment_${sfx}`,
      xrayFileUrl: `https://blob/xray_${sfx}`,
    },
  });
}

describe.skipIf(!hasDb)("deleteRequest", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ deleteRequest } = await import("@/server/request-deletion"));
  });

  afterEach(async () => {
    await db.user.deleteMany({ where: { id: { in: createdUsers } } });
    createdUsers.length = 0;
    h.deleted.length = 0;
    h.failFor.clear();
  });

  it("removes the request", async () => {
    const request = await seedRequest();

    expect(await deleteRequest(request.id)).toEqual({ ok: true });
    expect(await db.request.findUnique({ where: { id: request.id } })).toBeNull();
  });

  // This is the point of the whole action. Deleting a row and leaving the x-ray
  // in the blob store is not deletion; it is losing the only pointer to it.
  it("removes the uploaded files too", async () => {
    const request = await seedRequest();

    await deleteRequest(request.id);

    expect(h.deleted).toEqual(
      expect.arrayContaining([request.treatmentFileUrl, request.xrayFileUrl]),
    );
  });

  // Files first, row second. The other order would leave an x-ray in storage
  // with nothing pointing at it — a file nobody knows to delete.
  it("keeps the request when a file cannot be deleted", async () => {
    const request = await seedRequest();
    h.failFor.add(request.xrayFileUrl);

    const result = await deleteRequest(request.id);

    expect(result.ok).toBe(false);
    expect(await db.request.findUnique({ where: { id: request.id } })).not.toBeNull();
  });

  it("does not delete another user's request", async () => {
    const request = await seedRequest();
    h.clerkUserId.value = "someone_else_entirely";

    expect((await deleteRequest(request.id)).ok).toBe(false);
    expect(await db.request.findUnique({ where: { id: request.id } })).not.toBeNull();
    expect(h.deleted).toEqual([]);
  });

  it("takes the quotes down with it", async () => {
    const request = await seedRequest();
    const sfx = randomUUID().slice(0, 8);
    const dentist = await db.dentist.create({
      data: {
        clinicName: `C ${sfx}`,
        dentistName: `Dr ${sfx}`,
        email: `del_${sfx}@example.com`,
        phone: "+972500000000",
        city: "Tel Aviv",
        address: "1 St",
        experienceYears: 5,
      },
    });
    const rd = await db.requestDentist.create({
      data: { requestId: request.id, dentistId: dentist.id },
    });
    await db.quote.create({
      data: { requestDentistId: rd.id, amountMinor: 1000, currency: "ILS" },
    });

    await deleteRequest(request.id);

    expect(await db.quote.findFirst({ where: { requestDentistId: rd.id } })).toBeNull();
    await db.dentist.delete({ where: { id: dentist.id } });
  });
});
