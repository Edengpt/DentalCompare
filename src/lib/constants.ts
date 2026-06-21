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

export type HMO = (typeof HMO_OPTIONS)[number];
export type Specialty = (typeof SPECIALTIES)[number];
