import { formatMoney } from "./money";

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

export const HMO_OPTIONS = ["Clalit", "Maccabi", "Meuhedet", "Leumit"] as const;

export const SPECIALTIES = [
  "Implantology",
  "Endodontics",
  "Orthodontics",
  "Aesthetics",
  "Prosthodontics",
  "Pediatric",
  "Periodontics",
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

export type HMO = (typeof HMO_OPTIONS)[number];
export type Specialty = (typeof SPECIALTIES)[number];
export type Treatment = (typeof TREATMENTS)[number];

// --- Clinic subscription billing ---

// Prices are minor units + currency, never a bare number: once clinics exist
// outside Israel a plan price has to say which currency it is in. 29900 is
// 299.00 ILS.
export const SUBSCRIPTION_PLANS = {
  MONTHLY: { priceMinor: 29900, currency: "ILS", intervalMonths: 1, labelHe: "חודשי" },
  YEARLY: { priceMinor: 199000, currency: "ILS", intervalMonths: 12, labelHe: "שנתי" },
} as const;

export type SubscriptionPlanType = keyof typeof SUBSCRIPTION_PLANS;

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
  submitQuote: { limit: 10, windowMs: HOUR_MS }, // per quote token
  fileUpload: { limit: 20, windowMs: HOUR_MS }, // per request
  createRequest: { limit: 10, windowMs: HOUR_MS }, // per user — caps request spam
} as const;

/**
 * Renders a plan price for Hebrew copy. Goes through formatMoney so the symbol
 * comes from the plan's currency rather than a hardcoded ₪ — the terms have to
 * stay true once a plan is priced in euros.
 */
function planPriceLabel(plan: SubscriptionPlanType): string {
  const { priceMinor, currency } = SUBSCRIPTION_PLANS[plan];
  return formatMoney(priceMinor, currency, "he");
}

export const SUBSCRIPTION_TERMS_HE: string[] = [
  `המרפאה בוחרת מסלול מנוי: ${planPriceLabel("MONTHLY")} לחודש או ${planPriceLabel("YEARLY")} לשנה, עבור הופעה במאגר DentalCompare וקבלת פניות ממטופלים.`,
  `המרפאה מקבלת תקופת התנסות חינם של ${TRIAL_DAYS} יום, המתחילה במועד אישור המרפאה על ידי צוות DentalCompare. במהלך תקופה זו המרפאה מופיעה במאגר ומקבלת פניות ללא כל חיוב.`,
  `אמצעי התשלום נשמר כבר במעמד ההרשמה, והחיוב הראשון מתבצע אוטומטית בתום ${TRIAL_DAYS} ימי ההתנסות. תישלח התראה במייל לפני מועד החיוב הראשון.`,
  "ניתן לבטל בכל עת במהלך תקופת ההתנסות, ובמקרה זה לא יבוצע כל חיוב.",
  "המנוי מתחדש אוטומטית בתום כל תקופה באמצעי התשלום שנשמר, עד לביטול על ידי המרפאה.",
  "ניתן לבטל את המנוי בכל עת; הביטול ייכנס לתוקף בתום התקופה ששולמה. לא יינתן החזר יחסי.",
  "המרפאה מצהירה כי הפרטים שמסרה נכונים וכי היא בעלת הרישוי הנדרש לעיסוק ברפואת שיניים בישראל. DentalCompare רשאית להסיר את המרפאה מהמאגר בכל עת.",
];
