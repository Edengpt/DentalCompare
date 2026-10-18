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
  | "fieldTooLong"
  | "invalidEmail"
  | "invalidExperience"
  | "mustPickCountry"
  | "mustPickPlan"
  | "mustAcceptTerms";

const required = z.string().trim().min(1, "fieldRequired");

// The form is public, so every field gets a ceiling. Generous for any real
// clinic; what it stops is a script posting a megabyte into the admin queue.
const requiredText = (max: number) => required.max(max, "fieldTooLong");

/** Step 1 — who the clinic is and where it operates. */
export const clinicDetailsSchema = z.object({
  contactName: requiredText(120),
  dentistName: requiredText(120),
  clinicName: requiredText(200),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "fieldRequired")
    .max(254, "invalidEmail")
    .pipe(z.email("invalidEmail")),
  phone: requiredText(40),
  city: requiredText(120),
  address: requiredText(300),
  // Empty is "you skipped it", not "you typed nonsense" — the two get different
  // messages because they need different fixes.
  experienceYears: required.pipe(
    // A ceiling: an unbounded number overflows the Int column and turns a typo
    // into a 500. (Fractions are floored by the action, as before.)
    z.coerce
      .number<string>({ error: "invalidExperience" })
      .min(0, "invalidExperience")
      .max(80, "invalidExperience"),
  ),
  countryCode: z.string().trim().min(1, "mustPickCountry").max(8, "mustPickCountry"),
});

/** Step 3 — the plan and the contract. Step 2 (documents) depends on the country, see clinic-documents. */
export const clinicPlanSchema = z.object({
  // FREE, or the billing period of a paid plan. The server maps FREE to a free
  // MONTHLY row (see registerClinic).
  plan: z.enum(["FREE", "MONTHLY", "YEARLY"], { error: "mustPickPlan" }),
  // Which paid plan; ignored when `plan` is FREE. A form posted without it (an
  // older page still open in a browser) means Basic, the only paid plan then.
  tier: z.preprocess(
    (v) => (v === "" || v === undefined ? "BASIC" : v),
    z.enum(["FREE", "BASIC", "PRO"], { error: "mustPickPlan" }),
  ),
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
