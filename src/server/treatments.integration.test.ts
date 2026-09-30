import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";

const hasDb = Boolean(process.env.DATABASE_URL);
const DB_TIMEOUT = 60_000;

let db: typeof Db;
let treatments: typeof import("./treatments");
const created = { users: [] as string[], dentists: [] as string[] };

async function seedUser() {
  const sfx = randomUUID().slice(0, 8);
  const u = await db.user.create({
    data: {
      clerkUserId: `tr_${sfx}`,
      email: `tr_${sfx}@example.com`,
      fullName: `Patient ${sfx}`,
      phone: `+9725${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, "0")}`,
    },
  });
  created.users.push(u.id);
  return u;
}

async function seedClinic() {
  const sfx = randomUUID().slice(0, 8);
  const d = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: "Dr",
      email: `trc_${sfx}@example.com`,
      phone: "03",
      city: "Haifa",
      address: "1",
      experienceYears: 3,
    },
  });
  created.dentists.push(d.id);
  return d;
}

/** A request from `userId` to `dentistId` with a quote in `status`. */
async function seedTreatment(userId: string, dentistId: string, status: string) {
  const request = await db.request.create({
    data: { userId, treatmentFileUrl: "t", xrayFileUrl: "x", status: "SENT" },
  });
  const rd = await db.requestDentist.create({
    data: { requestId: request.id, dentistId, emailSent: true, quoteToken: randomUUID() },
  });
  await db.quote.create({
    data: {
      requestDentistId: rd.id,
      amountMinor: 500000,
      currency: "ILS",
      status: status as never,
      decidedAt: new Date(),
      warrantyYears: 5,
    },
  });
  return rd.id;
}

describe.skipIf(!hasDb)("treatment files (integration, real DB)", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    treatments = await import("./treatments");
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created.users) {
      await db.request.deleteMany({ where: { userId: id } }).catch(() => {});
      await db.user.delete({ where: { id } }).catch(() => {});
    }
    for (const id of created.dentists) await db.dentist.delete({ where: { id } }).catch(() => {});
    created.users = [];
    created.dentists = [];
  }, DB_TIMEOUT);

  it(
    "shows a patient every approved treatment, at every clinic, and nothing pending",
    async () => {
      const patient = await seedUser();
      const [a, b] = [await seedClinic(), await seedClinic()];
      await seedTreatment(patient.id, a.id, "COMPLETED");
      await seedTreatment(patient.id, b.id, "APPROVED");
      await seedTreatment(patient.id, b.id, "PENDING_DECISION");

      const list = await treatments.listPatientTreatments(patient.id);
      expect(list.map((t) => t.dentist.clinicName).sort()).toEqual(
        [a.clinicName, b.clinicName].sort(),
      );
    },
    DB_TIMEOUT,
  );

  it(
    "never opens another patient's file",
    async () => {
      const [owner, stranger] = [await seedUser(), await seedUser()];
      const clinic = await seedClinic();
      const rdId = await seedTreatment(owner.id, clinic.id, "IN_TREATMENT");

      expect(await treatments.getPatientTreatment(owner.id, rdId)).not.toBeNull();
      expect(await treatments.getPatientTreatment(stranger.id, rdId)).toBeNull();
    },
    DB_TIMEOUT,
  );

  it(
    "shows a clinic only its own treatments with a patient, not other clinics'",
    async () => {
      const patient = await seedUser();
      const [mine, theirs] = [await seedClinic(), await seedClinic()];
      const myRd = await seedTreatment(patient.id, mine.id, "COMPLETED");
      await seedTreatment(patient.id, theirs.id, "COMPLETED");
      // A quote the patient never approved is not a patient relationship.
      await seedTreatment(patient.id, mine.id, "PENDING_DECISION");

      const patients = await treatments.listClinicPatients(mine.id);
      expect(patients).toHaveLength(1);
      expect(patients[0].user.id).toBe(patient.id);
      expect(patients[0].treatments.map((t) => t.id)).toEqual([myRd]);
    },
    DB_TIMEOUT,
  );
});
