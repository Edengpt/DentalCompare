import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { registerClinic as RegisterFn } from "@/server/clinic-registration";

// headers() throws outside a request; the IP only keys the rate limiter.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.1" }),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ allowed: true, remaining: 99 }) }));

const hasDb = Boolean(process.env.DATABASE_URL);

// Imported lazily (only when a DB is configured) so the suite stays safe — and
// db.ts doesn't throw at import time — in environments without DATABASE_URL.
let db: typeof Db;
let registerClinic: typeof RegisterFn;

const emails: string[] = [];

function form(overrides: Record<string, string | string[]> = {}) {
  const email = `join_${randomUUID().slice(0, 8)}@example.com`;
  emails.push(email);
  const fd = new FormData();
  const base: Record<string, string> = {
    contactName: "Anna Kovacs",
    dentistName: "Dr Anna Kovacs",
    clinicName: "Buda Dental",
    email,
    phone: "0501234567",
    city: "Tel Aviv",
    address: "1 Main Street",
    experienceYears: "12",
    countryCode: "IL",
    plan: "MONTHLY",
    agreeToTerms: "on",
  };
  for (const [k, v] of Object.entries({ ...base, ...overrides })) {
    if (Array.isArray(v)) v.forEach((entry) => fd.append(k, entry));
    else fd.set(k, v);
  }
  return { fd, email };
}

describe.skipIf(!hasDb)("clinic registration", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ registerClinic } = await import("@/server/clinic-registration"));
  });

  afterEach(async () => {
    await db.dentist.deleteMany({ where: { email: { in: emails } } });
    emails.length = 0;
  });

  it("stores the languages the clinic ticked", async () => {
    const { fd, email } = form({ spokenLanguages: ["Hebrew", "English", "Hungarian"] });

    expect(await registerClinic(fd)).toEqual({ ok: true });

    const clinic = await db.dentist.findUnique({ where: { email } });
    expect(clinic?.spokenLanguages).toEqual(["Hebrew", "English", "Hungarian"]);
  });

  // The form posts from a public, unauthenticated page, so the submitted values
  // are whatever the sender chose to send.
  it("drops a language that is not on the canonical list", async () => {
    const { fd, email } = form({ spokenLanguages: ["English", "Klingon", "<script>"] });

    expect(await registerClinic(fd)).toEqual({ ok: true });

    const clinic = await db.dentist.findUnique({ where: { email } });
    expect(clinic?.spokenLanguages).toEqual(["English"]);
  });

  it("accepts a clinic that named no language at all", async () => {
    const { fd, email } = form();

    expect(await registerClinic(fd)).toEqual({ ok: true });

    const clinic = await db.dentist.findUnique({ where: { email } });
    expect(clinic?.spokenLanguages).toEqual([]);
  });

  it("de-duplicates a language sent twice", async () => {
    const { fd, email } = form({ spokenLanguages: ["Russian", "Russian"] });

    await registerClinic(fd);

    const clinic = await db.dentist.findUnique({ where: { email } });
    expect(clinic?.spokenLanguages).toEqual(["Russian"]);
  });
});
