import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "9.9.9.9" }),
}));

const hasDb = Boolean(process.env.DATABASE_URL);
const DB_TIMEOUT = 60_000;

let db: typeof Db;
let registerClinic: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;

const created: string[] = [];
const COUNTRY = "ZZ";
const DOC_URL = "https://x.blob.vercel-storage.com/clinics/documents/a.pdf";

function baseForm(sfx: string): FormData {
  const fd = new FormData();
  fd.append("contactName", "Ada");
  fd.append("dentistName", `Dr ${sfx}`);
  fd.append("clinicName", `Clinic ${sfx}`);
  fd.append("email", `reg_${sfx}@example.com`);
  fd.append("phone", "0500000000");
  fd.append("city", "Warsaw");
  fd.append("address", "Main 1");
  fd.append("experienceYears", "5");
  fd.append("agreeToTerms", "on");
  fd.append("plan", "MONTHLY");
  fd.append("countryCode", COUNTRY);
  return fd;
}

describe.skipIf(!hasDb)("registerClinic documents (integration, real DB)", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ registerClinic } = await import("./clinic-registration"));
    await db.country.upsert({
      where: { code: COUNTRY },
      update: { isActive: true, requiredDocs: ["Licence", "Insurance"] },
      create: {
        code: COUNTRY,
        nameEn: "Testland",
        currency: "EUR",
        callingCode: "999",
        insurers: [],
        requiredDocs: ["Licence", "Insurance"],
        isActive: true,
      },
    });
  }, DB_TIMEOUT);

  afterEach(async () => {
    for (const id of created) await db.dentist.delete({ where: { id } }).catch(() => {});
    created.length = 0;
    // The limiter is per IP and every test here shares one — without this the
    // fourth test in the file fails on rate limiting rather than on its subject.
    await db.rateLimit.deleteMany({ where: { bucket: "clinic-join:9.9.9.9" } });
  }, DB_TIMEOUT);

  it(
    "stores one document row per required kind",
    async () => {
      const sfx = randomUUID().slice(0, 8);
      const fd = baseForm(sfx);
      for (const kind of ["Licence", "Insurance"]) {
        fd.append("documentKind", kind);
        fd.append("documentUrl", `${DOC_URL}?k=${kind}`);
        fd.append("documentType", "application/pdf");
      }

      const result = await registerClinic(fd);
      expect(result.ok).toBe(true);

      const dentist = await db.dentist.findUnique({
        where: { email: `reg_${sfx}@example.com` },
        include: { documents: true },
      });
      created.push(dentist!.id);
      expect(dentist!.documents.map((d) => d.kind).sort()).toEqual(["Insurance", "Licence"]);
      // Registration never verifies. An admin looking at the documents does.
      expect(dentist!.licenceVerifiedAt).toBeNull();
    },
    DB_TIMEOUT,
  );

  it(
    "refuses the registration when a required document is missing, and creates nothing",
    async () => {
      const sfx = randomUUID().slice(0, 8);
      const fd = baseForm(sfx);
      fd.append("documentKind", "Licence");
      fd.append("documentUrl", DOC_URL);
      fd.append("documentType", "application/pdf");

      const result = await registerClinic(fd);
      expect(result.ok).toBe(false);

      // Half a registration is worse than none: the email is taken and the
      // clinic can never re-register.
      expect(
        await db.dentist.findUnique({ where: { email: `reg_${sfx}@example.com` } }),
      ).toBeNull();
    },
    DB_TIMEOUT,
  );

  // Without this a clinic could name any file on the internet as its licence —
  // including another clinic's private medical file, which an admin would then
  // open.
  it(
    "refuses a document url that did not come from our own upload route",
    async () => {
      const sfx = randomUUID().slice(0, 8);
      const fd = baseForm(sfx);
      for (const kind of ["Licence", "Insurance"]) {
        fd.append("documentKind", kind);
        fd.append("documentUrl", "https://evil.example.com/whatever.pdf");
        fd.append("documentType", "application/pdf");
      }

      const result = await registerClinic(fd);
      expect(result.ok).toBe(false);
      expect(
        await db.dentist.findUnique({ where: { email: `reg_${sfx}@example.com` } }),
      ).toBeNull();
    },
    DB_TIMEOUT,
  );
});
