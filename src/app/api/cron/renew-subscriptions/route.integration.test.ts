import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { db as Db } from "@/lib/db";
import type { visibleSubscriptionFilter as VisFilterFn } from "@/lib/subscription";

const {
  chargeByToken,
  isPayPlusConfigured,
  sendPaymentFailedEmail,
  sendTrialEndingEmail,
  sendTrialUnbilledAdminEmail,
} = vi.hoisted(() => ({
  chargeByToken: vi.fn(),
  isPayPlusConfigured: vi.fn(() => true),
  sendPaymentFailedEmail: vi.fn(async () => true),
  sendTrialEndingEmail: vi.fn(async (_args: { setupToken: string | null }) => true),
  // Argument types are declared so the assertions on mock.calls[0][0] are
  // typechecked rather than reaching into an untyped empty tuple.
  sendTrialUnbilledAdminEmail: vi.fn(
    async (_args: { clinicName: string; clinicEmail: string; reason: string }) => true,
  ),
}));

vi.mock("@/lib/payplus", async (orig) => {
  const actual = await orig<typeof import("@/lib/payplus")>();
  return { ...actual, chargeByToken, isPayPlusConfigured };
});
vi.mock("@/server/subscription-notifications", () => ({
  sendPaymentFailedEmail,
  sendTrialEndingEmail,
  sendTrialUnbilledAdminEmail,
}));

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
      trialDays: 60,
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

/**
 * A clinic inside (or just past) its free trial. Separate from seedSub because a
 * trialing subscription has no currentPeriodEnd — its clock is trialEndsAt, and
 * conflating the two is what let the whole trial pass go untested.
 */
async function seedTrialSub(opts: {
  trialEndsAtOffsetMs: number; // relative to now (negative = trial already over)
  withCard?: boolean; // did the clinic ever complete payment setup?
  warningSentDays?: number | null;
  endedUnbilled?: boolean;
}) {
  const sfx = randomUUID().slice(0, 8);
  const dentist = await db.dentist.create({
    data: {
      clinicName: `Trial Clinic ${sfx}`,
      dentistName: `Dr ${sfx}`,
      email: `trial_${sfx}@example.com`,
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
      trialDays: 60,
      status: "TRIALING",
      setupToken: `stk_${sfx}`,
      recurringToken: opts.withCard === false ? null : `rtok_${sfx}`,
      trialEndsAt: new Date(Date.now() + opts.trialEndsAtOffsetMs),
      trialWarningSentDays: opts.warningSentDays ?? null,
      trialEndedUnbilledAt: opts.endedUnbilled ? new Date() : null,
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
    sendTrialEndingEmail.mockClear();
    sendTrialUnbilledAdminEmail.mockClear();
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
  // ── The trial pass ────────────────────────────────────────────────────────
  //
  // Every test below used to be unreachable: the cron returned at its very first
  // line whenever PayPlus was unconfigured, which is exactly the state
  // production has always been in. A trialing clinic therefore got no warnings,
  // no charge and no expiry — free forever, with nothing anywhere saying so.

  it(
    "warns a clinic its trial is ending even when no payment provider is configured",
    async () => {
      isPayPlusConfigured.mockReturnValue(false);
      // Two days left: inside the 2-day warning mark, nothing sent yet.
      const { subId } = await seedTrialSub({ trialEndsAtOffsetMs: 2 * DAY });

      await GET(cronReq());

      expect(sendTrialEndingEmail).toHaveBeenCalledTimes(1);
      // A card is on file, so there is nothing to set up and the warning stays
      // the plain "you are about to be charged" notice.
      expect(sendTrialEndingEmail.mock.calls[0][0]).toMatchObject({ setupToken: null });
      const sub = await db.clinicSubscription.findUnique({ where: { id: subId } });
      expect(sub!.trialWarningSentDays).toBe(2);
      expect(sub!.status).toBe("TRIALING");
      expect(chargeByToken).not.toHaveBeenCalled();
    },
    DB_TIMEOUT,
  );

  it(
    "trial over with no provider -> stamped once, still TRIALING, still visible, admin told once",
    async () => {
      isPayPlusConfigured.mockReturnValue(false);
      const { dentistId, subId } = await seedTrialSub({ trialEndsAtOffsetMs: -DAY });

      await GET(cronReq());

      let sub = await db.clinicSubscription.findUnique({ where: { id: subId } });
      expect(sub!.trialEndedUnbilledAt).not.toBeNull();
      expect(sub!.status).toBe("TRIALING");
      expect(chargeByToken).not.toHaveBeenCalled();
      expect(sendTrialUnbilledAdminEmail).toHaveBeenCalledTimes(1);
      expect(sendTrialUnbilledAdminEmail.mock.calls[0][0]).toMatchObject({ reason: "no_provider" });

      // The clinic keeps its listing and keeps receiving leads — that was the
      // product decision, and it is the whole reason the stamp exists.
      const visible = await db.dentist.findFirst({
        where: { id: dentistId, subscription: visibleSubscriptionFilter() },
      });
      expect(visible).not.toBeNull();

      // The cron runs daily. A second run must not re-alert or move the stamp.
      const stampedAt = sub!.trialEndedUnbilledAt!.getTime();
      await GET(cronReq());
      sub = await db.clinicSubscription.findUnique({ where: { id: subId } });
      expect(sub!.trialEndedUnbilledAt!.getTime()).toBe(stampedAt);
      expect(sendTrialUnbilledAdminEmail).toHaveBeenCalledTimes(1);
    },
    DB_TIMEOUT,
  );

  it(
    "trial over with a live provider but no stored card -> same stamp, reason no_card",
    async () => {
      const { subId } = await seedTrialSub({ trialEndsAtOffsetMs: -DAY, withCard: false });

      await GET(cronReq());

      const sub = await db.clinicSubscription.findUnique({ where: { id: subId } });
      expect(sub!.trialEndedUnbilledAt).not.toBeNull();
      expect(sub!.status).toBe("TRIALING");
      expect(chargeByToken).not.toHaveBeenCalled();
      expect(sendTrialUnbilledAdminEmail.mock.calls[0][0]).toMatchObject({ reason: "no_card" });
    },
    DB_TIMEOUT,
  );

  it(
    "trial over with a provider and a card still converts to a paid subscription",
    async () => {
      chargeByToken.mockResolvedValue({
        ok: true,
        transactionUid: `txn_${randomUUID().slice(0, 8)}`,
      });
      const { subId } = await seedTrialSub({ trialEndsAtOffsetMs: -DAY });

      await GET(cronReq());

      const sub = await db.clinicSubscription.findUnique({ where: { id: subId } });
      expect(sub!.status).toBe("ACTIVE");
      expect(sub!.trialEndedUnbilledAt).toBeNull();
      expect(sub!.currentPeriodEnd!.getTime()).toBeGreaterThan(Date.now());
      expect(sendTrialUnbilledAdminEmail).not.toHaveBeenCalled();
    },
    DB_TIMEOUT,
  );

  it(
    "a trial already stamped is left alone — no repeat alert on later runs",
    async () => {
      isPayPlusConfigured.mockReturnValue(false);
      await seedTrialSub({ trialEndsAtOffsetMs: -10 * DAY, endedUnbilled: true });

      await GET(cronReq());

      expect(sendTrialUnbilledAdminEmail).not.toHaveBeenCalled();
    },
    DB_TIMEOUT,
  );
  // Approval starts the trial; payment setup is a separate link. A clinic that
  // never opened it must not be told we will charge "the card you saved".
  it(
    "the warning carries a setup link when the clinic never stored a card",
    async () => {
      await seedTrialSub({ trialEndsAtOffsetMs: 2 * DAY, withCard: false });

      await GET(cronReq());

      expect(sendTrialEndingEmail).toHaveBeenCalledTimes(1);
      expect(sendTrialEndingEmail.mock.calls[0][0].setupToken).toMatch(/^stk_/);
    },
    DB_TIMEOUT,
  );
});
