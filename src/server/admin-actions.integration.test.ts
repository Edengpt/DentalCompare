import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";

const { requireAdmin, sendPaymentSetupEmail } = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({ id: "u1", email: "admin@example.com" })),
  sendPaymentSetupEmail: vi.fn(async () => true),
}));

vi.mock("@/server/admin", async (orig) => {
  const actual = await orig<typeof import("@/server/admin")>();
  return { ...actual, requireAdmin };
});
vi.mock("@/server/subscription-notifications", () => ({ sendPaymentSetupEmail }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const hasDb = Boolean(process.env.DATABASE_URL);
const DB_TIMEOUT = 60_000;

let db: typeof Db;
let approveClinic: (id: string) => Promise<{ ok: boolean; error?: string }>;

const created: string[] = [];

async function seedPendingClinic() {
  const sfx = randomUUID().slice(0, 8);
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `appr_${sfx}@example.com`,
      phone: "0500000000",
      city: "חיפה",
      address: "רחוב 2",
      experienceYears: 3,
      specialties: [],
      treatments: [],
      insurerAffiliations: [],
      isActive: false,
      submittedBySelf: true,
      subscription: {
        create: {
          plan: "MONTHLY",
          priceMinor: 29900,
          currency: "ILS",
          setupToken: `stk_${sfx}`,
          status: "PENDING",
        },
      },
    },
  });
  created.push(dentist.id);
  return dentist.id;
}

describe.skipIf(!hasDb)("approveClinic (integration, real DB)", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ approveClinic } = await import("./admin-actions"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created) {
      await db.auditLog.deleteMany({ where: { entityId: id } }).catch(() => {});
      await db.dentist.delete({ where: { id } }).catch(() => {});
    }
    created.length = 0;
  }, DB_TIMEOUT);

  // One decision, two facts. The licence check and the trial clock are stamped
  // together but into separate columns, because the first is answered to a
  // regulator and the second to an accountant.
  it(
    "stamps the licence check, and names the admin who made it",
    async () => {
      const dentistId = await seedPendingClinic();

      const result = await approveClinic(dentistId);
      expect(result.ok).toBe(true);

      const d = await db.dentist.findUnique({ where: { id: dentistId } });
      expect(d!.licenceVerifiedAt).not.toBeNull();
      expect(d!.licenceVerifiedBy).toBe("admin@example.com");
      expect(d!.approvedAt).not.toBeNull();
      expect(d!.isActive).toBe(true);

      const sub = await db.clinicSubscription.findUnique({ where: { dentistId } });
      expect(sub!.status).toBe("TRIALING");
    },
    DB_TIMEOUT,
  );

  // Re-approving must not re-date a check that already happened, any more than
  // it hands out a fresh 60 free days.
  it(
    "does not move the stamp when the same clinic is approved twice, and keeps it listed",
    async () => {
      const dentistId = await seedPendingClinic();
      await approveClinic(dentistId);
      const first = (await db.dentist.findUnique({ where: { id: dentistId } }))!.licenceVerifiedAt!;

      await approveClinic(dentistId);
      const after = await db.dentist.findUnique({ where: { id: dentistId } });

      expect(after!.licenceVerifiedAt!.getTime()).toBe(first.getTime());
      expect(after!.isActive).toBe(true);
    },
    DB_TIMEOUT,
  );
  it(
    "refuses to create a clinic by hand with no document, and creates nothing",
    async () => {
      const { createDentist } = await import("./admin-actions");
      const sfx = randomUUID().slice(0, 8);
      const fd = new FormData();
      fd.append("clinicName", `Manual ${sfx}`);
      fd.append("dentistName", `Dr ${sfx}`);
      fd.append("email", `manual_${sfx}@example.com`);
      fd.append("phone", "0500000000");
      fd.append("city", "חיפה");
      fd.append("address", "רחוב 2");
      fd.append("experienceYears", "5");

      const result = await createDentist(fd);
      expect(result.ok).toBe(false);
      expect(
        await db.dentist.findUnique({ where: { email: `manual_${sfx}@example.com` } }),
      ).toBeNull();
    },
    DB_TIMEOUT,
  );

  // The admin is looking at the document while filling the form, so there is no
  // second decision to make — but the promise "every listed clinic has had its
  // licence seen" has to hold on this path too, or it is false on day one.
  it(
    "creates a hand-added clinic verified, with its document attached",
    async () => {
      const { createDentist } = await import("./admin-actions");
      const sfx = randomUUID().slice(0, 8);
      const email = `manual_${sfx}@example.com`;
      const fd = new FormData();
      fd.append("clinicName", `Manual ${sfx}`);
      fd.append("dentistName", `Dr ${sfx}`);
      fd.append("email", email);
      fd.append("phone", "0500000000");
      fd.append("city", "חיפה");
      fd.append("address", "רחוב 2");
      fd.append("experienceYears", "5");
      fd.append("documentKind", "licence");
      fd.append("documentUrl", "https://x.blob.vercel-storage.com/clinics/documents/m.pdf");
      fd.append("documentType", "application/pdf");

      const result = await createDentist(fd);
      expect(result.ok).toBe(true);

      const d = await db.dentist.findUnique({ where: { email }, include: { documents: true } });
      created.push(d!.id);
      expect(d!.licenceVerifiedAt).not.toBeNull();
      expect(d!.licenceVerifiedBy).toBe("admin@example.com");
      expect(d!.documents).toHaveLength(1);
    },
    DB_TIMEOUT,
  );
});
