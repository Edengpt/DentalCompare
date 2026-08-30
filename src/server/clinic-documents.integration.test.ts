import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";

const hasDb = Boolean(process.env.DATABASE_URL);
const DB_TIMEOUT = 60_000;

let db: typeof Db;
const created: string[] = [];

async function seedDentist() {
  const sfx = randomUUID().slice(0, 8);
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `doc_${sfx}@example.com`,
      phone: "0500000000",
      city: "חיפה",
      address: "רחוב 2",
      experienceYears: 3,
      specialties: [],
      treatments: [],
      insurerAffiliations: [],
    },
  });
  created.push(dentist.id);
  return dentist.id;
}

describe.skipIf(!hasDb)("ClinicDocument (integration, real DB)", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created) await db.dentist.delete({ where: { id } }).catch(() => {});
    created.length = 0;
  }, DB_TIMEOUT);

  it(
    "stores one document per kind and refuses a second of the same kind",
    async () => {
      const dentistId = await seedDentist();
      await db.clinicDocument.create({
        data: {
          dentistId,
          kind: "licence",
          blobUrl: "https://x.blob.vercel-storage.com/clinics/documents/a.pdf",
          contentType: "application/pdf",
        },
      });

      // One row per (clinic, kind) is what makes "the current licence" a fact
      // rather than a query over a history every reader has to get right.
      await expect(
        db.clinicDocument.create({
          data: {
            dentistId,
            kind: "licence",
            blobUrl: "https://x.blob.vercel-storage.com/clinics/documents/b.pdf",
            contentType: "application/pdf",
          },
        }),
      ).rejects.toThrow();
    },
    DB_TIMEOUT,
  );

  it(
    "deletes documents with the clinic — an orphan in private storage is the thing to avoid",
    async () => {
      const dentistId = await seedDentist();
      await db.clinicDocument.create({
        data: {
          dentistId,
          kind: "licence",
          blobUrl: "https://x.blob.vercel-storage.com/clinics/documents/c.pdf",
          contentType: "application/pdf",
        },
      });

      await db.dentist.delete({ where: { id: dentistId } });
      created.length = 0;

      expect(await db.clinicDocument.count({ where: { dentistId } })).toBe(0);
    },
    DB_TIMEOUT,
  );

  it(
    "starts every clinic unverified",
    async () => {
      const dentistId = await seedDentist();
      const d = await db.dentist.findUnique({ where: { id: dentistId } });
      expect(d!.licenceVerifiedAt).toBeNull();
      expect(d!.licenceVerifiedBy).toBeNull();
    },
    DB_TIMEOUT,
  );
});
