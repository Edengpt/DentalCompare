import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { getHomepageStats as StatsFn, StatsClient } from "@/lib/homepage-stats";

const hasDb = Boolean(process.env.DATABASE_URL);

// Imported lazily (only when a DB is configured) so the suite stays safe — and
// db.ts doesn't throw at import time — in environments without DATABASE_URL.
let db: typeof Db;
let getHomepageStats: typeof StatsFn;

const HOUR = 60 * 60 * 1000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR);

const ROLLBACK = Symbol("rollback");

/**
 * Runs a scenario against a database it fully owns, then throws it away.
 *
 * Every figure under test is a global aggregate, so seeding alongside whatever
 * the dev database already holds would make the assertions depend on it. Inside
 * the transaction the tables start empty, and nothing survives the rollback —
 * no real row is ever touched.
 */
async function inOwnedDatabase<T>(scenario: (tx: StatsClient & typeof Db) => Promise<T>) {
  let result!: T;
  try {
    await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          `TRUNCATE "Quote", "RequestDentist", "Request", "SubscriptionCharge",
           "ClinicSubscription", "Dentist", "User" CASCADE`,
        );
        result = await scenario(tx as unknown as StatsClient & typeof Db);
        throw ROLLBACK;
      },
      { timeout: 30_000 },
    );
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
  return result;
}

/** A clinic that is visible in the directory, and so countable. */
async function addVisibleClinic(tx: typeof Db, i: number, opts: { verified?: boolean } = {}) {
  const sfx = `${randomUUID().slice(0, 8)}_${i}`;
  const dentist = await tx.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `stats_${sfx}@example.com`,
      phone: "+972500000000",
      city: "Tel Aviv",
      address: "1 Main St",
      experienceYears: 10,
      isActive: true,
      // Visible means verified too, since P2a. Without the stamp the directory
      // hides the clinic, so counting it would put a number on the home page
      // that no patient can reach.
      licenceVerifiedAt: opts.verified === false ? null : new Date(),
      licenceVerifiedBy: opts.verified === false ? null : "admin@example.com",
    },
  });
  await tx.clinicSubscription.create({
    data: {
      dentistId: dentist.id,
      plan: "MONTHLY",
      status: "ACTIVE",
      priceMinor: 29900,
      currency: "ILS",
      setupToken: randomUUID(),
    },
  });
  return dentist;
}

/**
 * One sent request, plus a quote from each amount given.
 *
 * `sentHoursAgo` drives whether the 48-hour window has closed;
 * `quoteDelayHours` how long after sending the first quote landed.
 */
async function addRequest(
  tx: typeof Db,
  opts: {
    sentHoursAgo: number;
    quotes?: Array<{ minor: number; currency?: string }>;
    quoteDelayHours?: number;
  },
) {
  const sfx = randomUUID().slice(0, 8);
  const user = await tx.user.create({
    data: { clerkUserId: `stats_${sfx}`, fullName: "Test", email: `u_${sfx}@example.com` },
  });
  const sentAt = ago(opts.sentHoursAgo);
  const request = await tx.request.create({
    data: {
      userId: user.id,
      treatmentFileUrl: "https://blob/t",
      xrayFileUrl: "https://blob/x",
      status: "SENT",
      sentAt,
    },
  });

  for (const [i, quote] of (opts.quotes ?? []).entries()) {
    const dentist = await addVisibleClinic(tx, i);
    const rd = await tx.requestDentist.create({
      data: { requestId: request.id, dentistId: dentist.id, emailSent: true, sentAt },
    });
    await tx.quote.create({
      data: {
        requestDentistId: rd.id,
        amountMinor: quote.minor,
        currency: quote.currency ?? "ILS",
        createdAt: new Date(sentAt.getTime() + (opts.quoteDelayHours ?? 1) * HOUR),
      },
    });
  }
  return request;
}

describe.skipIf(!hasDb)("homepage stats", () => {
  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ getHomepageStats } = await import("@/lib/homepage-stats"));
  });

  it("shows nothing at all against an empty database", async () => {
    const stats = await inOwnedDatabase((tx) => getHomepageStats(tx));

    expect(stats).toEqual({ clinics: null, responseRate: null, medianSpread: null });
  });

  describe("clinic count", () => {
    it("stays null one clinic below the floor", async () => {
      const stats = await inOwnedDatabase(async (tx) => {
        for (let i = 0; i < 24; i++) await addVisibleClinic(tx, i);
        return getHomepageStats(tx);
      });

      expect(stats.clinics).toBeNull();
    });

    it("appears the moment the floor is reached", async () => {
      const stats = await inOwnedDatabase(async (tx) => {
        for (let i = 0; i < 25; i++) await addVisibleClinic(tx, i);
        return getHomepageStats(tx);
      });

      expect(stats.clinics).toBe(25);
    });

    // isActive alone would count it; the directory would not show it.
    it("ignores a clinic whose subscription has lapsed", async () => {
      const stats = await inOwnedDatabase(async (tx) => {
        for (let i = 0; i < 25; i++) await addVisibleClinic(tx, i);
        const lapsed = await addVisibleClinic(tx, 99);
        await tx.clinicSubscription.update({
          where: { dentistId: lapsed.id },
          data: { status: "CANCELED" },
        });
        return getHomepageStats(tx);
      });

      expect(stats.clinics).toBe(25);
    });

    // The home page says "every clinic here has had its licence seen". A clinic
    // without the stamp is hidden from the directory, so counting it would make
    // that sentence describe a set the patient cannot reach.
    it("ignores a clinic whose licence was never checked", async () => {
      const stats = await inOwnedDatabase(async (tx) => {
        for (let i = 0; i < 25; i++) await addVisibleClinic(tx, i);
        await addVisibleClinic(tx, 99, { verified: false });
        return getHomepageStats(tx);
      });

      expect(stats.clinics).toBe(25);
    });
  });

  describe("response rate", () => {
    it("counts a reply inside the window and a silence outside it", async () => {
      const stats = await inOwnedDatabase(async (tx) => {
        // 20 answered within 48h, 5 never answered → 80%.
        for (let i = 0; i < 20; i++) {
          await addRequest(tx, { sentHoursAgo: 72, quotes: [{ minor: 1000 }], quoteDelayHours: 2 });
        }
        for (let i = 0; i < 5; i++) await addRequest(tx, { sentHoursAgo: 72 });
        return getHomepageStats(tx);
      });

      expect(stats.responseRate).toBe(80);
    });

    it("counts a reply that arrived after the window as unanswered", async () => {
      const stats = await inOwnedDatabase(async (tx) => {
        for (let i = 0; i < 25; i++) {
          await addRequest(tx, {
            sentHoursAgo: 96,
            quotes: [{ minor: 1000 }],
            quoteDelayHours: 60,
          });
        }
        return getHomepageStats(tx);
      });

      expect(stats.responseRate).toBe(0);
    });

    // A request sent an hour ago has not failed to get a reply yet. Counting it
    // would drag the figure down in proportion to how busy the site is.
    it("leaves requests whose window is still open out of the denominator", async () => {
      const stats = await inOwnedDatabase(async (tx) => {
        for (let i = 0; i < 25; i++) {
          await addRequest(tx, { sentHoursAgo: 72, quotes: [{ minor: 1000 }] });
        }
        // Fifty more sent minutes ago, none answered. If they counted, the rate
        // would collapse from 100% to 33%.
        for (let i = 0; i < 50; i++) await addRequest(tx, { sentHoursAgo: 1 });
        return getHomepageStats(tx);
      });

      expect(stats.responseRate).toBe(100);
    });
  });

  describe("median quote spread", () => {
    it("stays null one request below the floor", async () => {
      const stats = await inOwnedDatabase(async (tx) => {
        for (let i = 0; i < 9; i++) {
          await addRequest(tx, {
            sentHoursAgo: 72,
            quotes: [{ minor: 1_000_00 }, { minor: 1_300_00 }],
          });
        }
        return getHomepageStats(tx);
      });

      expect(stats.medianSpread).toBeNull();
    });

    // One clinic quoting a wild number would drag a mean to a figure no patient
    // ever saw. The median keeps reporting what a typical one sees.
    it("is not moved by a single outlier", async () => {
      const stats = await inOwnedDatabase(async (tx) => {
        for (let i = 0; i < 9; i++) {
          await addRequest(tx, {
            sentHoursAgo: 72,
            quotes: [{ minor: 1_000_00 }, { minor: 1_300_00 }], // spread 300.00
          });
        }
        await addRequest(tx, {
          sentHoursAgo: 72,
          quotes: [{ minor: 1_000_00 }, { minor: 700_000_00 }], // spread 699,900.00
        });
        return getHomepageStats(tx);
      });

      // Mean would be ~70,260.00. Median is the typical case.
      expect(stats.medianSpread).toEqual({ minor: 30_000, currency: "ILS" });
    });

    it("ignores a request that has only one quote", async () => {
      const stats = await inOwnedDatabase(async (tx) => {
        for (let i = 0; i < 9; i++) {
          await addRequest(tx, {
            sentHoursAgo: 72,
            quotes: [{ minor: 1_000_00 }, { minor: 1_300_00 }],
          });
        }
        await addRequest(tx, { sentHoursAgo: 72, quotes: [{ minor: 5_000_00 }] });
        return getHomepageStats(tx);
      });

      expect(stats.medianSpread).toBeNull();
    });

    // Converting would fold an exchange rate the platform does not control into
    // a number it presents as fact.
    it("excludes a request priced in two currencies", async () => {
      const stats = await inOwnedDatabase(async (tx) => {
        for (let i = 0; i < 10; i++) {
          await addRequest(tx, {
            sentHoursAgo: 72,
            quotes: [{ minor: 1_000_00 }, { minor: 1_300_00 }],
          });
        }
        await addRequest(tx, {
          sentHoursAgo: 72,
          quotes: [
            { minor: 1_000_00, currency: "ILS" },
            { minor: 90_000_00, currency: "EUR" },
          ],
        });
        return getHomepageStats(tx);
      });

      expect(stats.medianSpread).toEqual({ minor: 30_000, currency: "ILS" });
    });
  });
});
