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

/** Clinics a patient may be shown: active, and paid up (or in trial/grace). */
export function publicDentistWhere(): Prisma.DentistWhereInput {
  return { isActive: true, subscription: visibleSubscriptionFilter() };
}
