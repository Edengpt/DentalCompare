import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { visibleSubscriptionFilter as VisFilterFn } from "@/lib/subscription";

const { chargeByToken, isPayPlusConfigured, sendPaymentFailedEmail } = vi.hoisted(() => ({
  chargeByToken: vi.fn(),
  isPayPlusConfigured: vi.fn(() => true),
  sendPaymentFailedEmail: vi.fn(async () => true),
}));

vi.mock("@/lib/payplus", async (orig) => {
  const actual = await orig<typeof import("@/lib/payplus")>();
  return { ...actual, chargeByToken, isPayPlusConfigured };
});
vi.mock("@/server/subscription-notifications", () => ({ sendPaymentFailedEmail }));

const hasDb = Boolean(process.env.DATABASE_URL);
const DB_TIMEOUT = 60_000;
const DAY = 24 * 60 * 60 * 1000;

let db: typeof Db;
let visibleSubscriptionFilter: typeof VisFilterFn;
let GET: (req: Request) => Promise<Response>;

const created = { dentistIds: [] as string[], subIds: [] as string[] };

async function seedSub(opts: {
  status: "ACTIVE" | "PAST_DUE";
  periodEndOffsetMs: number; // relative to now (negative = past)
  notified?: boolean;
}) {
  const sfx = randomUUID().slice(0, 8);
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `sub_${sfx}@example.com`,
      phone: "0500000000",
      city: "חיפה",
      address: "רחוב 2",
      experienceYears: 3,
      specialties: [],
      treatments: [],
      insurerAffiliations: [],
    },
  });
  created.dentistIds.push(dentist.id);
  const sub = await db.clinicSubscription.create({
    data: {
      dentistId: dentist.id,
      plan: "MONTHLY",
      priceMinor: 29900,
      currency: "ILS",
      status: opts.status,
      setupToken: `stk_${sfx}`,
      recurringToken: `rtok_${sfx}`,
      currentPeriodEnd: new Date(Date.now() + opts.periodEndOffsetMs),
      paymentFailedNotifiedAt: opts.notified ? new Date() : null,
    },
  });
  created.subIds.push(sub.id);
  return { dentistId: dentist.id, subId: sub.id };
}

const cronReq = () =>
  new Request("http://x", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });

describe.skipIf(!hasDb)("renew-subscriptions cron (integration, real DB)", () => {
  beforeAll(async () => {
    process.env.CRON_SECRET = process.env.CRON_SECRET || "itest-cron";
    ({ db } = await import("@/lib/db"));
    ({ visibleSubscriptionFilter } = await import("@/lib/subscription"));
    ({ GET } = await import("./route"));
  }, DB_TIMEOUT);

  beforeEach(() => {
    chargeByToken.mockReset();
    sendPaymentFailedEmail.mockClear();
    isPayPlusConfigured.mockReturnValue(true);
  });

  afterEach(async () => {
    // Audit rows have no FK to the subscription, so remove them explicitly.
    if (created.subIds.length)
      await db.auditLog.deleteMany({ where: { entityId: { in: created.subIds } } }).catch(() => {});
    for (const id of created.dentistIds)
      await db.dentist.delete({ where: { id } }).catch(() => {});
    created.dentistIds = [];
    created.subIds = [];
  }, DB_TIMEOUT);

  it(
    "failed charge in grace -> PAST_DUE, notified once, still visible; second run doesn't re-notify",
    async () => {
      chargeByToken.mockResolvedValue({ ok: false, error: "declined" });
      // Period just ended (due), inside the 3-day grace window.
      const { dentistId, subId } = await seedSub({ status: "ACTIVE", periodEndOffsetMs: -DAY });

      await GET(cronReq());
      let sub = await db.clinicSubscription.findUnique({ where: { id: subId } });
      expect(sub!.status).toBe("PAST_DUE");
      expect(sub!.paymentFailedNotifiedAt).not.toBeNull();
      expect(sendPaymentFailedEmail).toHaveBeenCalledTimes(1);

      // Still listed in the directory (PAST_DUE within grace).
      const visible = await db.dentist.findFirst({
        where: { id: dentistId, subscription: visibleSubscriptionFilter() },
      });
      expect(visible).not.toBeNull();

      // Second daily run: still failing, must NOT email again.
      await GET(cronReq());
      sub = await db.clinicSubscription.findUnique({ where: { id: subId } });
      expect(sub!.status).toBe("PAST_DUE");
      expect(sendPaymentFailedEmail).toHaveBeenCalledTimes(1);
    },
    DB_TIMEOUT,
  );

  it(
    "PAST_DUE past the grace window -> CANCELED and gone from the directory",
    async () => {
      chargeByToken.mockResolvedValue({ ok: false, error: "declined" });
      const { dentistId, subId } = await seedSub({
        status: "PAST_DUE",
        periodEndOffsetMs: -5 * DAY, // beyond the 3-day grace
        notified: true,
      });

      await GET(cronReq());
      const sub = await db.clinicSubscription.findUnique({ where: { id: subId } });
      expect(sub!.status).toBe("CANCELED");
      expect(sub!.canceledAt).not.toBeNull();
      expect(chargeByToken).not.toHaveBeenCalled();

      const visible = await db.dentist.findFirst({
        where: { id: dentistId, subscription: visibleSubscriptionFilter() },
      });
      expect(visible).toBeNull();
    },
    DB_TIMEOUT,
  );

  it(
    "successful charge renews -> ACTIVE, advances period, clears the notify flag",
    async () => {
      chargeByToken.mockResolvedValue({ ok: true, transactionUid: `txn_${randomUUID().slice(0, 8)}` });
      const { subId } = await seedSub({
        status: "PAST_DUE",
        periodEndOffsetMs: -DAY,
        notified: true,
      });

      await GET(cronReq());
      const sub = await db.clinicSubscription.findUnique({ where: { id: subId } });
      expect(sub!.status).toBe("ACTIVE");
      expect(sub!.paymentFailedNotifiedAt).toBeNull();
      expect(sub!.currentPeriodEnd!.getTime()).toBeGreaterThan(Date.now());
    },
    DB_TIMEOUT,
  );
});
