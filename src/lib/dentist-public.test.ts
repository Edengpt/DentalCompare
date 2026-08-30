import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PUBLIC_DENTIST_SELECT, publicDentistWhere } from "./dentist-public";
import { visibleSubscriptionFilter } from "./subscription";

/**
 * These assertions exist because the failure they guard is invisible.
 *
 * A `findMany` missing a `select` returns more than intended and renders
 * identically; a `findMany` missing the subscription gate returns more clinics
 * than intended and also renders identically. Nothing throws, no test that
 * checks the page fails, and the only symptom is a scrapeable contact list and
 * unpaid clinics in the directory.
 */
describe("what a patient may see about a clinic", () => {
  // Every one of these is on the clinic's registration form and none of them is
  // on the card. Adding one to the select puts it in the browser.
  const PRIVATE = [
    "email",
    "phone",
    "address",
    "contactName",
    "agreedToTermsAt",
    "termsVersion",
    "approvedAt",
    "submittedBySelf",
  ] as const;

  it.each(PRIVATE)("never exposes %s", (field) => {
    expect(PUBLIC_DENTIST_SELECT).not.toHaveProperty(field);
  });

  it("still carries everything the card renders", () => {
    for (const field of [
      "licenceVerifiedAt",
      "clinicName",
      "dentistName",
      "city",
      "experienceYears",
      "specialties",
      "insurerAffiliations",
      "spokenLanguages",
      "profileImageUrl",
      "rating",
      "reviewCount",
    ]) {
      expect(PUBLIC_DENTIST_SELECT).toHaveProperty(field, true);
    }
  });
});

describe("which clinics a patient may see", () => {
  // Both sides of the comparison below call new Date() independently, and the
  // grace cutoff is derived from it. One millisecond between the two calls made
  // this test fail at random — it did so on CI, which is worse than useless: a
  // suite that fails for no reason teaches everyone to ignore it. Freezing the
  // clock is the fix, not widening the assertion.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  // The directory is the product a clinic subscribes to. isActive alone lists
  // clinics that never set up a subscription or whose subscription lapsed.
  it("requires an active subscription as well as an active clinic", () => {
    expect(publicDentistWhere()).toEqual({
      isActive: true,
      licenceVerifiedAt: { not: null },
      subscription: visibleSubscriptionFilter(),
    });
  });

  // This one line is the whole of "every clinic in the directory has had its
  // licence seen" — the claim the home page makes. Nothing else enforces it.
  it("requires a licence an admin actually looked at", () => {
    expect(publicDentistWhere()).toHaveProperty("licenceVerifiedAt");
    expect(publicDentistWhere().licenceVerifiedAt).toEqual({ not: null });
  });

  it("keeps in lockstep with the shared visibility gate", () => {
    const statuses = publicDentistWhere().subscription as ReturnType<
      typeof visibleSubscriptionFilter
    >;
    expect(statuses.OR.map((o) => o.status).sort()).toEqual(["ACTIVE", "PAST_DUE", "TRIALING"]);
  });
});

/**
 * The badge is rendered from licenceVerifiedAt rather than as a constant.
 *
 * Every listed clinic is verified by construction, which is exactly why: if the
 * gate in publicDentistWhere ever breaks, a constant badge keeps claiming
 * "verified" about a clinic nobody checked, while one read from the data simply
 * disappears. When enforcement breaks, the promise should vanish, not lie.
 */
describe("the badge is a fact from the row", () => {
  it("carries the licence stamp in the public select", () => {
    expect(PUBLIC_DENTIST_SELECT).toHaveProperty("licenceVerifiedAt", true);
  });
});
