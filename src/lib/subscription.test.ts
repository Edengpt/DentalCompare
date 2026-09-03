import { describe, it, expect } from "vitest";
import {
  addMonths,
  nextPeriodEnd,
  isDueForRenewal,
  isClinicVisible,
  isWithinGrace,
  graceCutoff,
  trialEndFrom,
  isTrialOver,
  trialDaysRemaining,
  dueTrialWarning,
  visibleSubscriptionFilter,
  billingBlocker,
  hasCompletedPaymentSetup,
} from "./subscription";

describe("subscription helpers", () => {
  it("adds months and clamps end-of-month overflow", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
    expect(addMonths(new Date("2026-03-15T00:00:00Z"), 12).toISOString()).toBe(
      "2027-03-15T00:00:00.000Z",
    );
  });

  it("computes next period end from plan interval", () => {
    const from = new Date("2026-06-01T00:00:00Z");
    expect(nextPeriodEnd(from, "MONTHLY").toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(nextPeriodEnd(from, "YEARLY").toISOString()).toBe("2027-06-01T00:00:00.000Z");
  });

  it("is due for renewal within the lead window, not before", () => {
    const end = new Date("2026-06-10T00:00:00Z");
    expect(isDueForRenewal(end, new Date("2026-06-09T12:00:00Z"))).toBe(true); // within 1 day
    expect(isDueForRenewal(end, new Date("2026-06-08T00:00:00Z"))).toBe(false); // 2 days out
    expect(isDueForRenewal(end, new Date("2026-06-11T00:00:00Z"))).toBe(true); // already past
  });

  it("keeps a PAST_DUE clinic within grace (3 days) and cuts it off after", () => {
    const end = new Date("2026-06-10T00:00:00Z");
    // 2 days after period end → still in grace (3-day window).
    expect(isWithinGrace(end, new Date("2026-06-12T00:00:00Z"))).toBe(true);
    // 4 days after → outside grace.
    expect(isWithinGrace(end, new Date("2026-06-14T00:00:01Z"))).toBe(false);
    expect(isWithinGrace(null, new Date("2026-06-12T00:00:00Z"))).toBe(false);
  });

  it("treats TRIALING/ACTIVE, and PAST_DUE-in-grace, as visible; PENDING/lapsed/null as not", () => {
    const end = new Date("2026-06-10T00:00:00Z");
    const inGrace = new Date("2026-06-12T00:00:00Z");
    const afterGrace = new Date("2026-06-20T00:00:00Z");

    expect(isClinicVisible({ status: "TRIALING" }, inGrace)).toBe(true);
    expect(isClinicVisible({ status: "ACTIVE" }, inGrace)).toBe(true);
    expect(isClinicVisible({ status: "PAST_DUE", currentPeriodEnd: end }, inGrace)).toBe(true);
    expect(isClinicVisible({ status: "PAST_DUE", currentPeriodEnd: end }, afterGrace)).toBe(false);
    expect(isClinicVisible({ status: "PAST_DUE" }, inGrace)).toBe(false); // no period end
    expect(isClinicVisible({ status: "PENDING" }, inGrace)).toBe(false);
    expect(isClinicVisible({ status: "CANCELED" }, inGrace)).toBe(false);
    expect(isClinicVisible(null, inGrace)).toBe(false);
  });

  // A trial clinic that isn't in this filter silently receives nothing, with no
  // error anywhere — so pin the two in lockstep.
  it("visibleSubscriptionFilter covers exactly the statuses isClinicVisible accepts", () => {
    const now = new Date("2026-06-20T00:00:00Z");
    const statuses = visibleSubscriptionFilter(now).OR.map((c) => c.status);
    expect(statuses).toEqual(["TRIALING", "ACTIVE", "PAST_DUE"]);
    for (const s of statuses) {
      expect(isClinicVisible({ status: s, currentPeriodEnd: now }, now)).toBe(true);
    }
  });

  it("graceCutoff is PAST_DUE_GRACE_DAYS before now", () => {
    const now = new Date("2026-06-20T00:00:00Z");
    expect(graceCutoff(now).toISOString()).toBe("2026-06-17T00:00:00.000Z");
  });
});

describe("trialEndFrom", () => {
  it("adds the given number of trial days, not a hardcoded 60", () => {
    const approvedAt = new Date("2026-01-01T00:00:00.000Z");
    const result = trialEndFrom(approvedAt, 45);
    expect(result.toISOString()).toBe("2026-02-15T00:00:00.000Z");
  });
});

describe("free trial helpers", () => {
  const approved = new Date("2026-06-01T00:00:00Z");
  const trialEnd = new Date("2026-07-31T00:00:00Z"); // approved + 60 days

  it("ends the trial 60 days after approval, not after registration", () => {
    expect(trialEndFrom(approved, 60).toISOString()).toBe(trialEnd.toISOString());
  });

  it("is over only once the end has been reached", () => {
    expect(isTrialOver(trialEnd, new Date("2026-07-30T23:59:00Z"))).toBe(false);
    expect(isTrialOver(trialEnd, trialEnd)).toBe(true);
    expect(isTrialOver(trialEnd, new Date("2026-08-05T00:00:00Z"))).toBe(true);
    expect(isTrialOver(null, trialEnd)).toBe(false);
  });

  it("counts whole days remaining and floors at zero", () => {
    expect(trialDaysRemaining(trialEnd, new Date("2026-07-16T00:00:00Z"))).toBe(15);
    expect(trialDaysRemaining(trialEnd, new Date("2026-07-29T00:00:00Z"))).toBe(2);
    expect(trialDaysRemaining(trialEnd, new Date("2026-08-10T00:00:00Z"))).toBe(0);
  });

  it("fires each warning once and never re-fires one already sent", () => {
    const at15 = new Date("2026-07-16T00:00:00Z");
    const at2 = new Date("2026-07-29T00:00:00Z");

    // Nothing due while more than 15 days remain.
    expect(dueTrialWarning(trialEnd, null, new Date("2026-07-01T00:00:00Z"))).toBeNull();
    // The 15-day mark fires, then stays quiet on the next run.
    expect(dueTrialWarning(trialEnd, null, at15)).toBe(15);
    expect(dueTrialWarning(trialEnd, 15, at15)).toBeNull();
    // Later the 2-day mark fires, then also stays quiet.
    expect(dueTrialWarning(trialEnd, 15, at2)).toBe(2);
    expect(dueTrialWarning(trialEnd, 2, at2)).toBeNull();
  });

  it("skips straight to the smaller mark when a clinic is approved late in the window", () => {
    // Nothing was sent yet and only 2 days remain — send the 2-day warning, not 15.
    expect(dueTrialWarning(trialEnd, null, new Date("2026-07-29T00:00:00Z"))).toBe(2);
  });
});

describe("billingBlocker", () => {
  it("has no blocker when the provider is live and the clinic left a card", () => {
    expect(billingBlocker({ payplusConfigured: true, recurringToken: "rtok_1" })).toBeNull();
  });

  it("blames the provider when PayPlus is not configured at all", () => {
    expect(billingBlocker({ payplusConfigured: false, recurringToken: "rtok_1" })).toBe(
      "no_provider",
    );
  });

  it("blames the missing card when the provider is live but no token was stored", () => {
    expect(billingBlocker({ payplusConfigured: true, recurringToken: null })).toBe("no_card");
  });

  // Both are wrong at once. The provider is reported first because it is ours to
  // fix and it blocks every clinic — chasing one clinic for a card while the
  // provider is down would be the wrong action.
  it("reports the provider first when both are missing", () => {
    expect(billingBlocker({ payplusConfigured: false, recurringToken: null })).toBe("no_provider");
  });
});

describe("hasCompletedPaymentSetup", () => {
  it("is true for STRIPE once stripeSubscriptionId is set", () => {
    expect(
      hasCompletedPaymentSetup({
        provider: "STRIPE",
        recurringToken: null,
        stripeSubscriptionId: "sub_123",
      }),
    ).toBe(true);
  });

  it("is false for STRIPE with no stripeSubscriptionId, even if recurringToken is set", () => {
    // recurringToken is always null for STRIPE rows in practice, but a STRIPE
    // row must never be considered "set up" via the PayPlus field.
    expect(
      hasCompletedPaymentSetup({
        provider: "STRIPE",
        recurringToken: "rtok_1",
        stripeSubscriptionId: null,
      }),
    ).toBe(false);
  });

  it("is true for PAYPLUS once recurringToken is set", () => {
    expect(
      hasCompletedPaymentSetup({
        provider: "PAYPLUS",
        recurringToken: "rtok_1",
        stripeSubscriptionId: null,
      }),
    ).toBe(true);
  });

  it("is false for PAYPLUS with no recurringToken, even if stripeSubscriptionId is set", () => {
    // stripeSubscriptionId is always null for PAYPLUS rows in practice, but a
    // PAYPLUS row must never be considered "set up" via the Stripe field.
    expect(
      hasCompletedPaymentSetup({
        provider: "PAYPLUS",
        recurringToken: null,
        stripeSubscriptionId: "sub_123",
      }),
    ).toBe(false);
  });
});
