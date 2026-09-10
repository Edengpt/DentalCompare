import type { Prisma } from "@/generated/prisma/client";
import { visibleSubscriptionFilter } from "./subscription";

/**
 * What a patient is allowed to see about a clinic, and which clinics they see.
 *
 * Both halves live here together because both were wrong in the same query and
 * for the same reason: a `findMany` with neither a `select` nor the visibility
 * gate looks complete, compiles, renders correctly, and is wrong twice.
 *
 * **The select is a privacy boundary, not an optimisation.** A Dentist row
 * carries the clinic's email, phone, street address, the name of the person who
 * filled in the registration, and when they signed the subscription contract.
 * A server component that fetches the whole row serialises the whole row into
 * the page, where anyone with developer tools can read it. Listing the columns
 * a patient needs is the only thing standing between the directory and a
 * scrapeable list of every clinic's private contact details.
 *
 * **The where is a business boundary.** The directory is the product a clinic
 * subscribes to. Filtering on `isActive` alone lists clinics whose subscription
 * lapsed or was never set up, and the send step then silently drops them from
 * the patient's selection — so the patient loses a choice they thought they had
 * and a non-paying clinic got the exposure anyway.
 */

export const PUBLIC_DENTIST_SELECT = {
  id: true,
  clinicName: true,
  dentistName: true,
  city: true,
  countryCode: true,
  experienceYears: true,
  specialties: true,
  treatments: true,
  insurerAffiliations: true,
  spokenLanguages: true,
  profileImageUrl: true,
  rating: true,
  reviewCount: true,
  // Read by the card so the badge is a fact from the row rather than a
  // constant. See publicDentistWhere below for why that distinction matters.
  licenceVerifiedAt: true,
} satisfies Prisma.DentistSelect;

/**
 * A clinic as the patient-facing UI may know it.
 *
 * The card and the directory take this rather than the full model, so handing
 * either of them an unfiltered row stops being a judgement call and becomes a
 * type error.
 */
export type PublicDentist = Prisma.DentistGetPayload<{
  select: typeof PUBLIC_DENTIST_SELECT;
}>;

/**
 * Clinics a patient may be shown: active, paid up (or in trial/grace), and with
 * a licence an admin actually looked at.
 *
 * **The licence gate is the platform's promise, in one line.** Every clinic in
 * the directory has had its documents seen — that is the claim on the home page
 * and beside the directory, and this condition is the only thing enforcing it.
 *
 * It is also the same failure mode as visibleSubscriptionFilter: a clinic
 * missing the stamp vanishes with no error anywhere. Both paths that create a
 * clinic stamp it — approveClinic and createDentist. If a third is ever added,
 * it stamps too, or the clinics it creates are invisible and nothing says so.
 */
export function publicDentistWhere(): Prisma.DentistWhereInput {
  return {
    isActive: true,
    licenceVerifiedAt: { not: null },
    subscription: visibleSubscriptionFilter(),
  };
}
