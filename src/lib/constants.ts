export const SITE_CONFIG = {
  name: "DentalCompare",
  url: "https://dentalcompare.co.il",
  supportEmail: "support@dentalcompare.co.il",
  requestsEmail: "requests@dentalcompare.co.il",
} as const;

export const REQUEST_LIMITS = {
  minDentists: 1,
  // Deliberate lead-exclusivity cap (PRD 4.6), not a UI preference. A request
  // fanned out to 10 clinics gives each a ~10% close rate, so the subscription
  // reads as worthless and they churn. Three keeps each lead worth answering.
  maxDentists: 3,
  maxFileSizeMB: 20,
  allowedFileTypes: ["application/pdf", "image/jpeg", "image/png"] as const,
} as const;

// NOTE: there is deliberately no patient PRICING constant. The patient side is
// free end-to-end (PRD 4.1) — all revenue comes from clinic subscriptions below.
// Never reintroduce a patient-facing fee, paywall, or card collection step.

// NOTE: the Israeli HMO list used to live here as HMO_OPTIONS. It is now
// Country.insurers — every country has a different set of payers, and several
// have none at all, so a single hardcoded list can't be right for all of them.

export const SPECIALTIES = [
  "Implantology",
  "Endodontics",
  "Orthodontics",
  "Aesthetics",
  "Prosthodontics",
  "Pediatric",
  "Periodontics",
] as const;

/**
 * Languages a clinic's staff can actually hold a consultation in.
 *
 * A closed list rather than free text, because this is meant to be filtered on:
 * "clinics I can talk to" is the first filter a cross-border patient needs, and
 * free-typed "English"/"english"/"Eng" cannot be filtered or translated.
 *
 * A constant rather than a Country column, unlike insurers: staff languages are
 * not a property of the country — a Budapest clinic serving British patients
 * speaks English — and unlike a country, a language carries no configuration.
 * Adding one is this line plus a label in each dictionary, which is a code
 * change either way.
 */
export const SPOKEN_LANGUAGES = [
  "English",
  "Hebrew",
  "Arabic",
  "Russian",
  "French",
  "Spanish",
  "German",
  "Italian",
  "Turkish",
  "Hungarian",
  "Romanian",
  "Polish",
  "Greek",
  "Ukrainian",
] as const;

// Canonical treatment list — keep in sync with TREATMENT_LABELS_HE in labels.ts.
// Clinics pick from these so stored values always have a Hebrew label.
export const TREATMENTS = [
  "Implants",
  "Crowns",
  "Bridges",
  "Veneers",
  "Whitening",
  "Root Canal",
  "Braces",
  "Invisalign",
  "Gum Surgery",
  "Bone Grafting",
  "Pediatric Care",
  "Full Mouth Reconstruction",
] as const;

// What a quote covers. Canonical keys — the Hebrew/English labels live in
// labels.ts and, from the locale task onward, in the dictionaries. Stored as
// keys rather than free text so a patient can compare two clinics on the same
// axis instead of reading two differently-worded notes.
export const QUOTE_INCLUSIONS = [
  "XRAYS",
  "ANESTHESIA",
  "TEMP_CROWN",
  "FOLLOW_UP",
  "AIRPORT_TRANSFER",
  "ACCOMMODATION",
] as const;

export type QuoteInclusion = (typeof QUOTE_INCLUSIONS)[number];

export type Specialty = (typeof SPECIALTIES)[number];
export type Treatment = (typeof TREATMENTS)[number];

// --- Clinic subscription billing ---

// How many months one billing period is. Structural, not a price — Eden has
// never asked to edit what "monthly" or "yearly" means, only what they cost.
export const PLAN_INTERVAL_MONTHS = { MONTHLY: 1, YEARLY: 12 } as const;
export type SubscriptionPlanType = keyof typeof PLAN_INTERVAL_MONTHS;

// Prices are minor units + currency, never a bare number: once clinics exist
// outside Israel a plan price has to say which currency it is in. 29900 is
// 299.00 ILS.
export const SUBSCRIPTION_PLANS = {
  MONTHLY: { priceMinor: 29900, currency: "ILS", intervalMonths: 1 },
  YEARLY: { priceMinor: 199000, currency: "ILS", intervalMonths: 12 },
} as const;

// Charge this many days before currentPeriodEnd; allow this many days of grace
// after a failed charge before the clinic is treated as lapsed.
export const RENEWAL_LEAD_DAYS = 1;
export const PAST_DUE_GRACE_DAYS = 3;

// Free trial (PRD 4.4). Starts on admin approval, not on registration — the
// clinic can't evaluate lead quality before it's live in the directory. The card
// is collected up front, so the trial converts by non-cancellation.
export const TRIAL_DAYS = 60;
// Days-remaining marks at which the "your trial is ending" email goes out.
export const TRIAL_WARNING_DAYS_BEFORE = [15, 2] as const;

// Bumped when SUBSCRIPTION_TERMS_HE changes materially — v2 adds the 60-day free
// trial, so clinics that signed v1 agreed to different terms.
export const SUBSCRIPTION_CONTRACT_VERSION = "2026-08-sub-v2";

// --- Rate limits (DB-backed, fixed window) ---
const HOUR_MS = 60 * 60 * 1000;
export const RATE_LIMITS = {
  clinicRegister: { limit: 3, windowMs: HOUR_MS }, // per IP
  // Per IP. Higher than clinicRegister because one registration legitimately
  // uploads several documents, and a clinic that mis-shoots a photo retries.
  clinicDocument: { limit: 20, windowMs: HOUR_MS },
  submitQuote: { limit: 10, windowMs: HOUR_MS }, // per quote token
  fileUpload: { limit: 20, windowMs: HOUR_MS }, // per request
  createRequest: { limit: 10, windowMs: HOUR_MS }, // per user — caps request spam
} as const;

// SUBSCRIPTION_TERMS_HE lived here. The contract text is display copy, and a
// constant suffixed _HE can only ever be right for one language, so it moved to
// the dictionaries as clinics.terms — a template list the registration form
// fills with the plan prices and trial length.

/**
 * Version of the patient consent wording.
 *
 * Bumped whenever the wording changes materially. Stored next to the timestamp
 * so it is possible to show what a given patient actually agreed to — consent
 * without the wording it was given to proves nothing.
 */
export const PATIENT_CONSENT_VERSION = "2026-08-24";
