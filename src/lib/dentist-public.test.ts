import { describe, it, expect } from "vitest";
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
  // The directory is the product a clinic subscribes to. isActive alone lists
  // clinics that never set up a subscription or whose subscription lapsed.
  it("requires an active subscription as well as an active clinic", () => {
    expect(publicDentistWhere()).toEqual({
      isActive: true,
      subscription: visibleSubscriptionFilter(),
    });
  });

  it("keeps in lockstep with the shared visibility gate", () => {
    const statuses = publicDentistWhere().subscription as ReturnType<
      typeof visibleSubscriptionFilter
    >;
    expect(statuses.OR.map((o) => o.status).sort()).toEqual(["ACTIVE", "PAST_DUE", "TRIALING"]);
  });
});
