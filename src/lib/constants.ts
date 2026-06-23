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

// Commission contract clinics accept on self-registration.
export const COMMISSION = {
  version: "2026-06-v1",
  minFeeILS: 500,
  percent: 2,
  windowMonths: 12,
} as const;

// Plain-language clauses shown in the registration contract. The founder should
// have these reviewed by a lawyer before going live.
export const COMMISSION_TERMS_HE: string[] = [
  `עבור כל מטופל שהגיע למרפאה דרך פלטפורמת DentalCompare וסגר/התחיל טיפול, המרפאה תעביר ל-DentalCompare עמלת תיווך בגובה הגבוה מבין: ${COMMISSION.minFeeILS} ₪ או ${COMMISSION.percent}% משווי הטיפול הכולל.`,
  `ההתחייבות חלה גם אם המטופל סגר את הטיפול בתוך ${COMMISSION.windowMonths} חודשים ממועד ההפניה דרך הפלטפורמה.`,
  "המרפאה מתחייבת לדווח ל-DentalCompare על כל עסקה שנסגרה עם מטופל שהופנה דרך הפלטפורמה, ולשלם את העמלה תוך 14 ימים ממועד סגירת הטיפול.",
  "המרפאה מצהירה כי הפרטים שמסרה נכונים, וכי היא בעלת הרישוי הנדרש לעיסוק ברפואת שיניים בישראל.",
  "DentalCompare רשאית להסיר את המרפאה מהמאגר בכל עת. ההרשמה כפופה לאישור מנהל לפני פרסום בפלטפורמה.",
];

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

export type HMO = (typeof HMO_OPTIONS)[number];
export type Specialty = (typeof SPECIALTIES)[number];
