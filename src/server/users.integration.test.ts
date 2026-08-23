import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { getOrCreateUser as GetOrCreateFn } from "@/server/users";

/**
 * What happens to an existing patient when the Clerk instance changes.
 *
 * Swapping a Clerk development instance for a production one gives every
 * existing person a brand new clerkUserId. getOrCreateUser looks up by that id,
 * finds nothing, and creates a row — against a table where email is unique. The
 * insert fails, the patient gets a 500, and the account they already had is
 * unreachable forever, with their request and x-ray still sitting behind it.
 */

const h = vi.hoisted(() => ({
  clerkUserId: { value: "" },
  email: { value: "" },
  firstName: { value: null as string | null },
  emailVerified: { value: true },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.clerkUserId.value }),
  currentUser: async () => ({
    id: h.clerkUserId.value,
    firstName: h.firstName.value,
    lastName: null,
    primaryEmailAddressId: "eid",
    emailAddresses: [
      {
        id: "eid",
        emailAddress: h.email.value,
        verification: { status: h.emailVerified.value ? "verified" : "unverified" },
      },
    ],
    primaryPhoneNumberId: null,
    phoneNumbers: [],
  }),
}));

const hasDb = Boolean(process.env.DATABASE_URL);

// Imported lazily (only when a DB is configured) so the suite stays safe — and
// db.ts doesn't throw at import time — in environments without DATABASE_URL.
let db: typeof Db;
let getOrCreateUser: typeof GetOrCreateFn;

const emails: string[] = [];

function freshIdentity(firstName: string | null = null) {
  const sfx = randomUUID().slice(0, 8);
  const email = `relink_${sfx}@example.com`;
  emails.push(email);
  h.clerkUserId.value = `old_instance_${sfx}`;
  h.email.value = email;
  h.firstName.value = firstName;
  h.emailVerified.value = true;
  return { email, sfx };
}

describe.skipIf(!hasDb)("getOrCreateUser across a Clerk instance swap", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ getOrCreateUser } = await import("@/server/users"));
  });

  afterEach(async () => {
    await db.user.deleteMany({ where: { email: { in: emails } } });
    emails.length = 0;
  });

  it("creates the row on a first visit, as before", async () => {
    const { email } = freshIdentity();

    const user = await getOrCreateUser();

    expect(user?.email).toBe(email);
  });

  // The whole point: same person, same verified email, new id from a new
  // instance. They must land back in their own account.
  it("re-links an existing account when the clerk id has changed", async () => {
    const { email, sfx } = freshIdentity("Dana");
    const first = await getOrCreateUser();

    h.clerkUserId.value = `new_instance_${sfx}`;
    const second = await getOrCreateUser();

    expect(second?.id).toBe(first?.id);
    expect(second?.clerkUserId).toBe(`new_instance_${sfx}`);
    expect(await db.user.count({ where: { email } })).toBe(1);
  });

  it("keeps the request attached to the re-linked account", async () => {
    const { sfx } = freshIdentity();
    const first = await getOrCreateUser();
    const request = await db.request.create({
      data: { userId: first!.id, treatmentFileUrl: "https://b/t", xrayFileUrl: "https://b/x" },
    });

    h.clerkUserId.value = `new_instance_${sfx}`;
    const second = await getOrCreateUser();

    const after = await db.request.findUnique({ where: { id: request.id } });
    expect(after?.userId).toBe(second?.id);
  });

  it("does not lose a name the old account had when the new one has none", async () => {
    const { sfx } = freshIdentity("Dana");
    await getOrCreateUser();

    h.clerkUserId.value = `new_instance_${sfx}`;
    h.firstName.value = null;
    const second = await getOrCreateUser();

    expect(second?.fullName).toBe("Dana");
  });

  // Without this, anyone could type a stranger's address and inherit their
  // treatment plan and x-ray. Clerk verifies email at sign-up today; the guard
  // is here so that changing that dashboard setting cannot silently make this
  // unsafe.
  it("refuses to re-link on an unverified email", async () => {
    const { email, sfx } = freshIdentity();
    const first = await getOrCreateUser();

    h.clerkUserId.value = `impostor_${sfx}`;
    h.emailVerified.value = false;

    await expect(getOrCreateUser()).rejects.toThrow();

    const rows = await db.user.findMany({ where: { email } });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(first?.id);
  });
});
