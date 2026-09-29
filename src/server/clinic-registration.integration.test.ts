import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { foundingPriceMinor } from "@/lib/founding";
import type { db as Db } from "@/lib/db";
import { requiredDocKinds } from "@/lib/clinic-documents";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "9.9.9.9" }),
}));

const hasDb = Boolean(process.env.DATABASE_URL);
const DB_TIMEOUT = 60_000;

let db: typeof Db;
let registerClinic: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;

const created: string[] = [];
// Not "ZZ": every integration test shares one database, and travel-actions
// asserts that "ZZ" is NOT an active country. Creating it here made those tests
// fail on a country this file left behind rather than on their own subject.
// The row is removed in afterAll for the same reason.
const COUNTRY = "QV";
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

  afterAll(async () => {
    await db.country.delete({ where: { code: COUNTRY } }).catch(() => {});
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
    "prices a YEARLY registration off the yearly rate, not the monthly one",
    async () => {
      const pricing = await db.subscriptionPricing.findUniqueOrThrow({
        where: { provider_tier: { provider: "STRIPE", tier: "BASIC" } },
      });

      const sfx = randomUUID().slice(0, 8);
      const fd = baseForm(sfx);
      fd.set("plan", "YEARLY");
      for (const kind of ["Licence", "Insurance"]) {
        fd.append("documentKind", kind);
        fd.append("documentUrl", `${DOC_URL}?k=${kind}`);
        fd.append("documentType", "application/pdf");
      }

      const result = await registerClinic(fd);
      expect(result.ok).toBe(true);

      const dentist = await db.dentist.findUnique({
        where: { email: `reg_${sfx}@example.com` },
        include: { subscription: true },
      });
      created.push(dentist!.id);
      const sub = dentist!.subscription!;
      expect(sub.plan).toBe("YEARLY");
      // The list price is the yearly rate whether or not a founding place was
      // still open; the founding price, when given, is derived from it.
      const listPrice = sub.isFounding ? sub.regularPriceMinor : sub.priceMinor;
      expect(listPrice).toBe(pricing.yearlyPriceMinor);
      if (sub.isFounding) {
        expect(sub.priceMinor).toBe(foundingPriceMinor(pricing.yearlyPriceMinor, pricing.currency));
      }
      expect(sub.currency).toBe(pricing.currency);
      // The actual failure mode this guards against: the ternary in
      // clinic-registration.ts picking the monthly rate regardless of plan.
      expect(listPrice).not.toBe(pricing.monthlyPriceMinor);
    },
    DB_TIMEOUT,
  );

  it(
    "registers the free tier at no charge with its own request cap",
    async () => {
      const free = await db.subscriptionPricing.findUniqueOrThrow({
        where: { provider_tier: { provider: "STRIPE", tier: "FREE" } },
      });
      const sfx = randomUUID().slice(0, 8);
      const fd = baseForm(sfx);
      fd.set("plan", "FREE");
      for (const kind of ["Licence", "Insurance"]) {
        fd.append("documentKind", kind);
        fd.append("documentUrl", `${DOC_URL}?k=${kind}`);
        fd.append("documentType", "application/pdf");
      }

      const result = await registerClinic(fd);
      expect(result.ok).toBe(true);

      const dentist = await db.dentist.findUnique({
        where: { email: `reg_${sfx}@example.com` },
        include: { subscription: true },
      });
      created.push(dentist!.id);
      const sub = dentist!.subscription!;
      expect(sub.tier).toBe("FREE");
      expect(sub.priceMinor).toBe(0);
      expect(sub.isFounding).toBe(false);
      expect(sub.monthlyRequestCap).toBe(free.monthlyRequestCap);
    },
    DB_TIMEOUT,
  );

  it(
    "tags a non-Israeli registration STRIPE and an Israeli one PAYPLUS, each priced off its own provider row",
    async () => {
      const stripePricing = await db.subscriptionPricing.findUniqueOrThrow({
        where: { provider_tier: { provider: "STRIPE", tier: "BASIC" } },
      });
      const payplusPricing = await db.subscriptionPricing.findUniqueOrThrow({
        where: { provider_tier: { provider: "PAYPLUS", tier: "BASIC" } },
      });

      const ilCountry = await db.country.upsert({
        where: { code: "IL" },
        update: { isActive: true },
        create: {
          code: "IL",
          nameEn: "Israel",
          currency: "ILS",
          callingCode: "972",
          insurers: [],
          requiredDocs: [],
          isActive: true,
        },
      });
      const qvCountry = await db.country.findUniqueOrThrow({ where: { code: COUNTRY } });

      const nonIlSfx = randomUUID().slice(0, 8);
      const nonIlForm = baseForm(nonIlSfx); // COUNTRY = "QV", already non-Israel
      // registerClinic requires one document per kind the clinic's country
      // configures — not this test's own subject, but required to reach the
      // provider-resolution logic this test actually checks.
      for (const kind of requiredDocKinds(qvCountry.requiredDocs)) {
        nonIlForm.append("documentKind", kind);
        nonIlForm.append("documentUrl", `${DOC_URL}?k=${kind}`);
        nonIlForm.append("documentType", "application/pdf");
      }
      const nonIlResult = await registerClinic(nonIlForm);
      expect(nonIlResult.ok).toBe(true);
      const nonIlDentist = await db.dentist.findUnique({
        where: { email: `reg_${nonIlSfx}@example.com` },
        include: { subscription: true },
      });
      created.push(nonIlDentist!.id);
      expect(nonIlDentist!.subscription!.provider).toBe("STRIPE");
      expect(nonIlDentist!.subscription!.tier).toBe("BASIC");
      expect(nonIlDentist!.subscription!.currency).toBe(stripePricing.currency);
      expect(nonIlDentist!.subscription!.trialDays).toBe(stripePricing.trialDays);

      const ilSfx = randomUUID().slice(0, 8);
      const ilForm = baseForm(ilSfx);
      ilForm.set("countryCode", "IL");
      for (const kind of requiredDocKinds(ilCountry.requiredDocs)) {
        ilForm.append("documentKind", kind);
        ilForm.append("documentUrl", `${DOC_URL}?k=${kind}`);
        ilForm.append("documentType", "application/pdf");
      }
      const ilResult = await registerClinic(ilForm);
      expect(ilResult.ok).toBe(true);
      const ilDentist = await db.dentist.findUnique({
        where: { email: `reg_${ilSfx}@example.com` },
        include: { subscription: true },
      });
      created.push(ilDentist!.id);
      expect(ilDentist!.subscription!.provider).toBe("PAYPLUS");
      expect(ilDentist!.subscription!.tier).toBe("BASIC");
      expect(ilDentist!.subscription!.currency).toBe(payplusPricing.currency);
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
