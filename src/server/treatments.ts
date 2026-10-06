import "server-only";
import { QUOTE_DETAIL_SELECT, QUOTE_ROW_ATTACHMENTS_SELECT, quoteDetailFields } from "./quote-rows";
import { db } from "@/lib/db";
import type { QuoteStatus } from "@/generated/prisma/enums";
import type { QuoteRow } from "@/lib/quotes";
import { countryName } from "@/lib/country-names";

/**
 * The shared treatment file: one per quote the patient approved, seen by the
 * patient and by that clinic only.
 *
 * Built entirely from what the request already holds — the files, the
 * approved quote and the lifecycle dates. Nothing new is collected, which is
 * the point of this first version: no new medical data, no new obligations.
 */
export const TREATMENT_STATUSES: QuoteStatus[] = [
  "APPROVED",
  "IN_TREATMENT",
  "COMPLETION_REQUESTED",
  "COMPLETED",
];

const QUOTE_SELECT = {
  ...QUOTE_DETAIL_SELECT,
  status: true,
  amountMinor: true,
  currency: true,
  note: true,
  includes: true,
  accommodationNights: true,
  tripsRequired: true,
  daysPerTrip: true,
  weeksBetweenTrips: true,
  sessionsRequired: true,
  weeksBetweenSessions: true,
  warrantyYears: true,
  warrantyNote: true,
  rejectedAuto: true,
  decidedAt: true,
  treatmentStartedAt: true,
  treatmentStartedBy: true,
  completionRequestedAt: true,
  completedAt: true,
} as const;

const DENTIST_SELECT = {
  id: true,
  clinicName: true,
  dentistName: true,
  phone: true,
  email: true,
  address: true,
  city: true,
  spokenLanguages: true,
  country: { select: { code: true, nameEn: true } },
} as const;

/** Every treatment the patient approved, at any clinic, newest first. */
export async function listPatientTreatments(userId: string) {
  return db.requestDentist.findMany({
    where: {
      request: { userId },
      quote: { status: { in: TREATMENT_STATUSES } },
    },
    orderBy: { quote: { decidedAt: "desc" } },
    select: {
      id: true,
      dentist: { select: DENTIST_SELECT },
      quote: { select: QUOTE_SELECT },
    },
  });
}

/** One treatment file, or null when it isn't this patient's. */
export async function getPatientTreatment(userId: string, requestDentistId: string) {
  return db.requestDentist.findFirst({
    where: {
      id: requestDentistId,
      request: { userId },
      quote: { status: { in: TREATMENT_STATUSES } },
    },
    select: {
      id: true,
      request: { select: { id: true, treatmentFileUrl: true, xrayFileUrl: true } },
      dentist: { select: DENTIST_SELECT },
      quote: { select: QUOTE_SELECT },
      attachments: QUOTE_ROW_ATTACHMENTS_SELECT,
    },
  });
}

/**
 * The clinic's patients: people who approved one of ITS quotes, each with only
 * the treatments done at this clinic. Treatments at other clinics never reach
 * this query — the dentistId condition is on the row itself.
 */
export async function listClinicPatients(dentistId: string) {
  const rows = await db.requestDentist.findMany({
    where: {
      dentistId,
      quote: { status: { in: TREATMENT_STATUSES } },
      request: { userId: { not: null } },
    },
    orderBy: { quote: { decidedAt: "desc" } },
    select: {
      id: true,
      quote: { select: QUOTE_SELECT },
      request: {
        select: {
          user: { select: { id: true, fullName: true, email: true, phone: true } },
        },
      },
    },
  });

  const patients = new Map<
    string,
    {
      user: NonNullable<(typeof rows)[number]["request"]["user"]>;
      treatments: typeof rows;
    }
  >();
  for (const row of rows) {
    const user = row.request.user;
    if (!user) continue;
    const entry = patients.get(user.id) ?? { user, treatments: [] };
    entry.treatments.push(row);
    patients.set(user.id, entry);
  }
  return [...patients.values()];
}

type TreatmentRow = NonNullable<Awaited<ReturnType<typeof getPatientTreatment>>>;

/** The approved quote in the shape the comparison component renders. */
export function toQuoteRow(row: TreatmentRow, locale: string): QuoteRow {
  const q = row.quote!;
  const d = row.dentist;
  return {
    dentistId: d.id,
    requestDentistId: row.id,
    status: q.status,
    dentistName: d.dentistName,
    clinicName: d.clinicName,
    city: d.city,
    amountMinor: q.amountMinor,
    currency: q.currency,
    country: d.country ? countryName(d.country.code, locale, d.country.nameEn) : null,
    spokenLanguages: d.spokenLanguages,
    includes: q.includes,
    accommodationNights: q.accommodationNights,
    tripsRequired: q.tripsRequired,
    daysPerTrip: q.daysPerTrip,
    weeksBetweenTrips: q.weeksBetweenTrips,
    sessionsRequired: q.sessionsRequired,
    weeksBetweenSessions: q.weeksBetweenSessions,
    warrantyYears: q.warrantyYears,
    warrantyNote: q.warrantyNote,
    note: q.note,
    rejectedAuto: q.rejectedAuto,
    ...quoteDetailFields(q, row.attachments),
  };
}
