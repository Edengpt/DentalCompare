import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { getClinicForCurrentUser as GetClinicFn } from "@/server/clinic-account";

/**
 * Which clinic an account speaks for.
 *
 * The link is made on a VERIFIED email address and nothing else. An unverified
 * address proves only that someone typed it, and treating it as proof would let
 * anyone claim any clinic by signing up with its published contact address —
 * the address is on the clinic's own listing.
 */

const clerkState = {
  userId: null as string | null,
  email: "",
  verified: true,
};

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: clerkState.userId }),
  currentUser: async () =>
    clerkState.userId
      ? {
          id: clerkState.userId,
          primaryEmailAddressId: "eml_1",
          emailAddresses: [
            {
              id: "eml_1",
              emailAddress: clerkState.email,
              verification: { status: clerkState.verified ? "verified" : "unverified" },
            },
          ],
        }
      : null,
}));

const hasDb = Boolean(process.env.DATABASE_URL);

let db: typeof Db;
let getClinicForCurrentUser: typeof GetClinicFn;

const created = { dentistIds: [] as string[] };

async function seedClinic(email: string, extra: Record<string, unknown> = {}) {
  const sfx = randomUUID().slice(0, 8);
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email,
      phone: `+9725${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, "0")}`,
      city: "Tel Aviv",
      address: "1 Main St",
      experienceYears: 10,
      isActive: true,
      ...extra,
    },
  });
  created.dentistIds.push(dentist.id);
  return dentist;
}

describe.skipIf(!hasDb)("getClinicForCurrentUser (integration, real DB)", () => {
  const DB_TIMEOUT = 60_000;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ getClinicForCurrentUser } = await import("@/server/clinic-account"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.dentistIds) await db.dentist.delete({ where: { id } }).catch(() => {});
    created.dentistIds = [];
    clerkState.userId = null;
    clerkState.email = "";
    clerkState.verified = true;
  }, DB_TIMEOUT);

  it("returns null when nobody is signed in", async () => {
    expect(await getClinicForCurrentUser()).toBeNull();
  });

  it("links an account to its clinic on a verified address, and stamps it", async () => {
    const email = `acct_${randomUUID().slice(0, 8)}@example.com`;
    const clinic = await seedClinic(email);
    clerkState.userId = `user_${randomUUID().slice(0, 8)}`;
    clerkState.email = email;

    const found = await getClinicForCurrentUser();

    expect(found?.id).toBe(clinic.id);
    const row = await db.dentist.findUnique({ where: { id: clinic.id } });
    expect(row?.clerkUserId).toBe(clerkState.userId);
  });

  // The clinic's contact address is published on its own listing. If an
  // unverified address were enough, claiming someone else's clinic would be a
  // sign-up form away.
  it("refuses to link on an unverified address", async () => {
    const email = `acct_${randomUUID().slice(0, 8)}@example.com`;
    const clinic = await seedClinic(email);
    clerkState.userId = `user_${randomUUID().slice(0, 8)}`;
    clerkState.email = email;
    clerkState.verified = false;

    expect(await getClinicForCurrentUser()).toBeNull();
    const row = await db.dentist.findUnique({ where: { id: clinic.id } });
    expect(row?.clerkUserId).toBeNull();
  });

  it("returns null for an account matching no clinic", async () => {
    clerkState.userId = `user_${randomUUID().slice(0, 8)}`;
    clerkState.email = `nobody_${randomUUID().slice(0, 8)}@example.com`;

    expect(await getClinicForCurrentUser()).toBeNull();
  });

  // Once stamped, the id is the link. This is what keeps the clinic reachable
  // after it changes its contact address in the admin screen.
  it("finds the clinic by the stamped id even when the email no longer matches", async () => {
    const userId = `user_${randomUUID().slice(0, 8)}`;
    const clinic = await seedClinic(`old_${randomUUID().slice(0, 8)}@example.com`, {
      clerkUserId: userId,
    });
    clerkState.userId = userId;
    clerkState.email = `different_${randomUUID().slice(0, 8)}@example.com`;

    const found = await getClinicForCurrentUser();
    expect(found?.id).toBe(clinic.id);
  });

  // Two clinics cannot share one account. The stamp wins over a stale email
  // match, so a second clinic later registering the old address cannot steal it.
  it("prefers the stamped clinic over an email match on another row", async () => {
    const userId = `user_${randomUUID().slice(0, 8)}`;
    const email = `shared_${randomUUID().slice(0, 8)}@example.com`;
    const stamped = await seedClinic(`mine_${randomUUID().slice(0, 8)}@example.com`, {
      clerkUserId: userId,
    });
    await seedClinic(email);
    clerkState.userId = userId;
    clerkState.email = email;

    const found = await getClinicForCurrentUser();
    expect(found?.id).toBe(stamped.id);
  });
});
