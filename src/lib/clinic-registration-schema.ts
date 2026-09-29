import { z } from "zod";

/**
 * What a valid clinic registration looks like, before anything that needs the
 * database (is the email taken, is the country active, are the documents ours).
 *
 * Shared by the wizard and the server action on purpose. Two copies of "what
 * counts as filled in" drift, and then the wizard lets a clinic through a step
 * only for the server to refuse the whole form at the end — the worst moment to
 * find out.
 *
 * Messages are keys of the `errors` dictionary rather than text, so the same
 * rule speaks Hebrew in the browser and whatever the request's locale is on the
 * server.
 */
export type RegistrationErrorKey =
  | "fieldRequired"
  | "invalidEmail"
  | "invalidExperience"
  | "mustPickCountry"
  | "mustPickPlan"
  | "mustAcceptTerms";

const required = z.string().trim().min(1, "fieldRequired");

/** Step 1 — who the clinic is and where it operates. */
export const clinicDetailsSchema = z.object({
  contactName: required,
  dentistName: required,
  clinicName: required,
  email: z.string().trim().toLowerCase().min(1, "fieldRequired").pipe(z.email("invalidEmail")),
  phone: required,
  city: required,
  address: required,
  // Empty is "you skipped it", not "you typed nonsense" — the two get different
  // messages because they need different fixes.
  experienceYears: required.pipe(
    z.coerce.number<string>({ error: "invalidExperience" }).min(0, "invalidExperience"),
  ),
  countryCode: z.string().trim().min(1, "mustPickCountry"),
});

/** Step 3 — the plan and the contract. Step 2 (documents) depends on the country, see clinic-documents. */
export const clinicPlanSchema = z.object({
  // FREE is a tier, not a billing interval; the server maps it to a free
  // MONTHLY row (see registerClinic). Kept in one field so the form stays a
  // single choice of three cards.
  plan: z.enum(["FREE", "MONTHLY", "YEARLY"], { error: "mustPickPlan" }),
  agreeToTerms: z.enum(["on", "true"], { error: "mustAcceptTerms" }),
});

export const clinicRegistrationSchema = clinicDetailsSchema.extend(clinicPlanSchema.shape);

const FIELDS = [
  ...Object.keys(clinicDetailsSchema.shape),
  ...Object.keys(clinicPlanSchema.shape),
] as const;

/** The single-valued registration fields, each as a string ("" when absent). */
export function readRegistrationFields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of FIELDS) {
    const v = formData.get(name);
    out[name] = typeof v === "string" ? v : "";
  }
  return out;
}

/** First error per field, keyed by field name. Empty when the parse succeeded. */
export function fieldErrors(result: {
  success: boolean;
  error?: z.ZodError;
}): Record<string, RegistrationErrorKey> {
  const out: Record<string, RegistrationErrorKey> = {};
  for (const issue of result.error?.issues ?? []) {
    const field = String(issue.path[0] ?? "");
    if (field && !(field in out)) out[field] = issue.message as RegistrationErrorKey;
  }
  return out;
}
