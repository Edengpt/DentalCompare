import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";

const { requireAdmin, sendPaymentSetupEmail, sendDocumentsRejectedEmail } = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({ id: "u1", email: "admin@example.com" })),
  sendPaymentSetupEmail: vi.fn(async () => true),
  sendDocumentsRejectedEmail: vi.fn(
    async (_args: { token: string; items: { kind: string; reason: string }[] }) => true,
  ),
}));

vi.mock("@/server/admin", async (orig) => {
  const actual = await orig<typeof import("@/server/admin")>();
  return { ...actual, requireAdmin };
});
vi.mock("@/server/subscription-notifications", () => ({
  sendPaymentSetupEmail,
  sendDocumentsRejectedEmail,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const hasDb = Boolean(process.env.DATABASE_URL);
const DB_TIMEOUT = 60_000;

let db: typeof Db;
let approveClinic: (id: string) => Promise<{ ok: boolean; error?: string }>;

const created: string[] = [];

async function seedPendingClinic(trialDays = 60) {
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
          trialDays,
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

  // Call counts are asserted per test, and vitest does not clear them between
  // tests on its own — without this, calls[1] in one test is a call another
  // test made.
  beforeEach(() => {
    sendDocumentsRejectedEmail.mockClear();
    sendPaymentSetupEmail.mockClear();
  });

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

  // The whole point of freezing trialDays onto the subscription row: an admin
  // changing the live setting between registration and approval must not
  // silently change what a clinic that already registered gets.
  it(
    "gives the trial length the clinic saw at registration, not whatever the live setting says now",
    async () => {
      const dentistId = await seedPendingClinic(60);

      const original = await db.subscriptionPricing.findUniqueOrThrow({
        where: { provider: "PAYPLUS" },
      });
      await db.subscriptionPricing.update({
        where: { provider: "PAYPLUS" },
        data: { trialDays: 30 },
      });
      try {
        const result = await approveClinic(dentistId);
        expect(result.ok).toBe(true);

        const sub = await db.clinicSubscription.findUniqueOrThrow({ where: { dentistId } });
        const dentist = await db.dentist.findUniqueOrThrow({ where: { id: dentistId } });
        const expectedMs =
          dentist.approvedAt!.getTime() + 60 * 24 * 60 * 60 * 1000; // 60 days, not 30
        expect(sub.trialEndsAt!.getTime()).toBe(expectedMs);
      } finally {
        await db.subscriptionPricing.update({
          where: { provider: "PAYPLUS" },
          data: { trialDays: original.trialDays },
        });
      }
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
  async function seedClinicWithDoc() {
    const dentistId = await seedPendingClinic();
    const doc = await db.clinicDocument.create({
      data: {
        dentistId,
        kind: "Licence",
        blobUrl: "https://x.blob.vercel-storage.com/clinics/documents/r.pdf",
        contentType: "application/pdf",
      },
    });
    return { dentistId, docId: doc.id };
  }

  it(
    "marks the document rejected, issues a token with an expiry, and emails the clinic",
    async () => {
      const { requestBetterDocuments } = await import("./admin-actions");
      const { dentistId, docId } = await seedClinicWithDoc();

      const result = await requestBetterDocuments(dentistId, [
        { documentId: docId, reason: "התמונה מטושטשת" },
      ]);
      expect(result.ok).toBe(true);

      const doc = await db.clinicDocument.findUnique({ where: { id: docId } });
      expect(doc!.rejectedAt).not.toBeNull();
      expect(doc!.rejectionReason).toBe("התמונה מטושטשת");

      const d = await db.dentist.findUnique({ where: { id: dentistId } });
      expect(d!.documentToken).toBeTruthy();
      // Unlike the payment token, this one dies on its own.
      expect(d!.documentTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
      // Not an approval path: still unlisted, still unverified. A document
      // nobody could read is not a licence anyone saw.
      expect(d!.isActive).toBe(false);
      expect(d!.licenceVerifiedAt).toBeNull();

      expect(sendDocumentsRejectedEmail).toHaveBeenCalledTimes(1);
      expect(sendDocumentsRejectedEmail.mock.calls[0][0].items).toEqual([
        { kind: "Licence", reason: "התמונה מטושטשת" },
      ]);
    },
    DB_TIMEOUT,
  );

  // A second round has to reach the clinic, so the link it is sent must be one
  // that works. Reusing a token that may already have expired sends a dead link
  // and produces another round of silence.
  it(
    "issues a fresh token on a second round rather than reusing the old one",
    async () => {
      const { requestBetterDocuments } = await import("./admin-actions");
      const { dentistId, docId } = await seedClinicWithDoc();

      await requestBetterDocuments(dentistId, [{ documentId: docId, reason: "blurry" }]);
      const first = (await db.dentist.findUnique({ where: { id: dentistId } }))!.documentToken;

      await requestBetterDocuments(dentistId, [{ documentId: docId, reason: "still blurry" }]);
      const second = (await db.dentist.findUnique({ where: { id: dentistId } }))!.documentToken;

      expect(second).not.toBe(first);
      expect(sendDocumentsRejectedEmail.mock.calls[1][0].token).toBe(second);
    },
    DB_TIMEOUT,
  );

  // Documents belong to clinics. Passing another clinic's document id must not
  // reject it under the wrong clinic and email the wrong people about it.
  it(
    "refuses a document that belongs to a different clinic",
    async () => {
      const { requestBetterDocuments } = await import("./admin-actions");
      const { docId } = await seedClinicWithDoc();
      const otherId = await seedPendingClinic();

      const result = await requestBetterDocuments(otherId, [
        { documentId: docId, reason: "blurry" },
      ]);
      expect(result.ok).toBe(false);
      expect((await db.clinicDocument.findUnique({ where: { id: docId } }))!.rejectedAt).toBeNull();
    },
    DB_TIMEOUT,
  );
});
