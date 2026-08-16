import type { RequestStatus } from "@/generated/prisma/enums";
import type { HMO, Specialty } from "./constants";

/**
 * Request status labels. There is no payment state in the patient journey any
 * more (PRD 4.1), so these describe delivery only. Was duplicated across three
 * pages before the free-patient migration — keep it single-sourced.
 */
export const REQUEST_STATUS_LABELS_HE: Record<RequestStatus, string> = {
  DRAFT: "טיוטה",
  SUBMITTED: "בשליחה",
  SENT: "נשלחה",
  FAILED: "השליחה נכשלה",
};

export const HMO_LABELS_HE: Record<HMO, string> = {
  Clalit: "כללית",
  Maccabi: "מכבי",
  Meuhedet: "מאוחדת",
  Leumit: "לאומית",
};

export const SPECIALTY_LABELS_HE: Record<Specialty, string> = {
  Implantology: "השתלות",
  Endodontics: "טיפולי שורש",
  Orthodontics: "יישור שיניים",
  Aesthetics: "אסתטיקה",
  Prosthodontics: "שיקום הפה",
  Pediatric: "ילדים",
  Periodontics: "חניכיים",
};

// Treatments are seeded with free-form English strings — map the common ones.
// Unknown values fall through as-is.
export const TREATMENT_LABELS_HE: Record<string, string> = {
  Implants: "השתלות",
  Crowns: "כתרים",
  Bridges: "גשרים",
  Veneers: "ציפויי חרסינה",
  Whitening: "הלבנת שיניים",
  "Root Canal": "טיפולי שורש",
  Braces: "יישור שיניים",
  Invisalign: "אינוויזליין",
  "Gum Surgery": "ניתוחי חניכיים",
  "Bone Grafting": "השתלת עצם",
  "Pediatric Care": "טיפולי שיניים לילדים",
  "Full Mouth Reconstruction": "שיקום פה מלא",
};

export function translateTreatment(t: string) {
  return TREATMENT_LABELS_HE[t] ?? t;
}

export function translateSpecialty(s: string) {
  return SPECIALTY_LABELS_HE[s as Specialty] ?? s;
}

export function translateHmo(h: string) {
  return HMO_LABELS_HE[h as HMO] ?? h;
}
