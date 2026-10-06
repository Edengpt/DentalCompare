import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { saveTravelChoice as SaveFn } from "@/server/travel-actions";

const h = vi.hoisted(() => ({ clerkUserId: { value: "" } }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.clerkUserId.value }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const hasDb = Boolean(process.env.DATABASE_URL);

// Imported lazily (only when a DB is configured) so the suite stays safe — and
// db.ts doesn't throw at import time — in environments without DATABASE_URL.
let db: typeof Db;
let saveTravelChoice: typeof SaveFn;

const createdUsers: string[] = [];

async function seedRequest() {
  const sfx = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: { clerkUserId: `travel_${sfx}`, fullName: "T", email: `t_${sfx}@example.com` },
  });
  createdUsers.push(user.id);
  h.clerkUserId.value = user.clerkUserId;
  return db.request.create({
    data: { userId: user.id, treatmentFileUrl: "https://b/t", xrayFileUrl: "https://b/x" },
  });
}

function form(values: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) {
    if (Array.isArray(v)) v.forEach((entry) => fd.append(k, entry));
    else fd.set(k, v);
  }
  return fd;
}

describe.skipIf(!hasDb)("saveTravelChoice", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ saveTravelChoice } = await import("@/server/travel-actions"));
  });

  afterEach(async () => {
    await db.user.deleteMany({ where: { id: { in: createdUsers } } });
    createdUsers.length = 0;
  });

  it("puts the country on the user and the travel scope on the request", async () => {
    const request = await seedRequest();

    const result = await saveTravelChoice(
      form({
        requestId: request.id,
        countryCode: "IL",
        travelScope: "SELECTED",
        destinations: ["IL"],
      }),
    );

    expect(result).toEqual({ ok: true });
    const after = await db.request.findUnique({
      where: { id: request.id },
      include: { user: { select: { countryCode: true } } },
    });
    expect(after?.travelScope).toBe("SELECTED");
    expect(after?.destinationCountries).toEqual(["IL"]);
    expect(after?.user?.countryCode).toBe("IL");
  });

  // A patient in Brazil flying to Istanbul lives in Brazil, clinics or not.
  it("accepts a home country that has no clinics", async () => {
    const request = await seedRequest();

    const result = await saveTravelChoice(
      form({ requestId: request.id, countryCode: "BR", travelScope: "ANY" }),
    );

    expect(result).toEqual({ ok: true });
    const after = await db.request.findUnique({
      where: { id: request.id },
      include: { user: { select: { countryCode: true } } },
    });
    expect(after?.user?.countryCode).toBe("BR");
  });

  // "Only in my country" with no clinics there would find nobody.
  it("refuses LOCAL where the home country has no clinics", async () => {
    const request = await seedRequest();

    const result = await saveTravelChoice(
      form({ requestId: request.id, countryCode: "BR", travelScope: "LOCAL" }),
    );

    expect(result.ok).toBe(false);
  });

  // The country decides which currency prices are compared in. A value
  // invented in the form does not get to decide that.
  it("refuses a code that is not a real country", async () => {
    const request = await seedRequest();

    const result = await saveTravelChoice(
      form({ requestId: request.id, countryCode: "ZZ", travelScope: "LOCAL" }),
    );

    expect(result.ok).toBe(false);
  });

  it("drops a destination that is not an active country instead of storing it", async () => {
    const request = await seedRequest();

    await saveTravelChoice(
      form({
        requestId: request.id,
        countryCode: "IL",
        travelScope: "SELECTED",
        destinations: ["IL", "ZZ"],
      }),
    );

    const after = await db.request.findUnique({ where: { id: request.id } });
    expect(after?.destinationCountries).toEqual(["IL"]);
  });

  // Destinations are meaningless unless the patient said they would travel.
  it("stores no destinations when the scope is not SELECTED", async () => {
    const request = await seedRequest();

    await saveTravelChoice(
      form({ requestId: request.id, countryCode: "IL", travelScope: "ANY", destinations: ["IL"] }),
    );

    const after = await db.request.findUnique({ where: { id: request.id } });
    expect(after?.travelScope).toBe("ANY");
    expect(after?.destinationCountries).toEqual([]);
  });

  // Someone else's request and a request that does not exist get the same answer.
  it("does not touch another user's request", async () => {
    const request = await seedRequest();
    h.clerkUserId.value = "someone_else_entirely";

    const result = await saveTravelChoice(
      form({ requestId: request.id, countryCode: "IL", travelScope: "ANY" }),
    );

    expect(result.ok).toBe(false);
    const after = await db.request.findUnique({ where: { id: request.id } });
    expect(after?.travelScope).toBe("LOCAL");
  });

  it("refuses once the request has already been sent", async () => {
    const request = await seedRequest();
    await db.request.update({ where: { id: request.id }, data: { status: "SENT" } });

    const result = await saveTravelChoice(
      form({ requestId: request.id, countryCode: "IL", travelScope: "ANY" }),
    );

    expect(result.ok).toBe(false);
  });
});
