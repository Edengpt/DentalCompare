export const SITE_CONFIG = {
  name: "DentalCompare",
  url: "https://dentalcompare.co.il",
  supportEmail: "support@dentalcompare.co.il",
  requestsEmail: "requests@dentalcompare.co.il",
} as const;

export const REQUEST_LIMITS = {
  minDentists: 1,
  maxDentists: 10,
  maxFileSizeMB: 20,
  allowedFileTypes: ["application/pdf", "image/jpeg", "image/png"] as const,
} as const;

export const PRICING = {
  flatFeeILS: 49,
  currency: "ils",
} as const;

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

export const SUBSCRIPTION_PLANS = {
  MONTHLY: { priceILS: 299, intervalMonths: 1, labelHe: "חודשי" },
  YEARLY: { priceILS: 1990, intervalMonths: 12, labelHe: "שנתי" },
} as const;

export type SubscriptionPlanType = keyof typeof SUBSCRIPTION_PLANS;

// Charge this many days before currentPeriodEnd; allow this many days of grace
// after a failed charge before the clinic is treated as lapsed.
export const RENEWAL_LEAD_DAYS = 1;
export const PAST_DUE_GRACE_DAYS = 3;

export const SUBSCRIPTION_CONTRACT_VERSION = "2026-06-sub-v1";

// --- Rate limits (DB-backed, fixed window) ---
const HOUR_MS = 60 * 60 * 1000;
export const RATE_LIMITS = {
  clinicRegister: { limit: 3, windowMs: HOUR_MS }, // per IP
  submitQuote: { limit: 10, windowMs: HOUR_MS }, // per quote token
  fileUpload: { limit: 20, windowMs: HOUR_MS }, // per request
} as const;

export const SUBSCRIPTION_TERMS_HE: string[] = [
  `המרפאה בוחרת מסלול מנוי: ${SUBSCRIPTION_PLANS.MONTHLY.priceILS} ₪ לחודש או ${SUBSCRIPTION_PLANS.YEARLY.priceILS} ₪ לשנה, עבור הופעה במאגר DentalCompare וקבלת פניות ממטופלים.`,
  "החיוב הראשון מתבצע לאחר אישור המרפאה על ידי צוות DentalCompare. כל עוד לא הושלם תשלום, המרפאה אינה מופיעה במאגר.",
  "המנוי מתחדש אוטומטית בתום כל תקופה באמצעי התשלום שנשמר, עד לביטול על ידי המרפאה.",
  "ניתן לבטל את המנוי בכל עת; הביטול ייכנס לתוקף בתום התקופה ששולמה. לא יינתן החזר יחסי.",
  "המרפאה מצהירה כי הפרטים שמסרה נכונים וכי היא בעלת הרישוי הנדרש לעיסוק ברפואת שיניים בישראל. DentalCompare רשאית להסיר את המרפאה מהמאגר בכל עת.",
];
