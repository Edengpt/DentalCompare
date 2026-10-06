/**
 * The treatments a clinic can put on a quote, as a three-level tree:
 * category -> treatment -> optional variant (crown material, brace type...).
 *
 * Canonical keys, not display text — the labels live in the dictionaries
 * (labels.quoteCategories / quoteTreatments / quoteVariants), so a patient
 * reading in Russian compares a Turkish and a Hungarian clinic on the same
 * axis. Same rule as QUOTE_INCLUSIONS.
 *
 * Every category ends with OTHER, which carries the clinic's own wording
 * (QuoteItem.customLabel): real quotes include a CT scan or an All-on-4 that no
 * fixed list anticipates, and a clinic with nowhere to put it either misfiles
 * it or abandons the form.
 *
 * Client-safe: no database or server imports.
 */
export const TREATMENT_CATALOG = {
  PREVENTIVE: {
    EXAM_XRAY: null,
    CLEANING: null,
    FILLING: null,
    ROOT_CANAL: null,
    SIMPLE_EXTRACTION: null,
    OTHER: null,
  },
  SURGICAL: {
    IMPLANT: null,
    SURGICAL_EXTRACTION: null,
    BONE_GRAFT: null,
    SINUS_LIFT: ["OPEN", "CLOSED"],
    OTHER: null,
  },
  RESTORATIVE: {
    POST_CORE: null,
    CROWN: ["ZIRCONIA", "PFM", "EMAX"],
    BRIDGE: null,
    DENTURE: null,
    OTHER: null,
  },
  COSMETIC: {
    WHITENING: null,
    VENEER: null,
    GUM_CONTOURING: null,
    OTHER: null,
  },
  ORTHODONTICS: {
    BRACES: ["METAL", "CERAMIC"],
    CLEAR_ALIGNERS: null,
    LINGUAL_BRACES: null,
    OTHER: null,
  },
  PERIODONTICS: {
    ROOT_PLANING: null,
    GUM_SURGERY: null,
    OTHER: null,
  },
  PEDIATRIC: {
    SEALANTS: null,
    PULPOTOMY: null,
    STAINLESS_CROWN: null,
    NITROUS_SEDATION: null,
    OTHER: null,
  },
} as const satisfies Record<string, Record<string, readonly string[] | null>>;

type Catalog = typeof TREATMENT_CATALOG;
type CatalogShape = Record<string, Record<string, readonly string[] | null>>;
export type TreatmentCategory = keyof Catalog;

export const TREATMENT_CATEGORIES = Object.keys(TREATMENT_CATALOG) as TreatmentCategory[];

/** The free-text treatment present in every category. */
export const OTHER_TREATMENT = "OTHER";
export const CUSTOM_LABEL_MAX = 80;

function categoryOf(category: string): Record<string, readonly string[] | null> | null {
  return Object.hasOwn(TREATMENT_CATALOG, category)
    ? (TREATMENT_CATALOG as CatalogShape)[category]
    : null;
}

/** The treatments offered under a category, in display order. */
export function catalogTreatments(category: string): string[] {
  const c = categoryOf(category);
  return c ? Object.keys(c) : [];
}

/** The variants a treatment must be narrowed to, or null when it has none. */
export function catalogVariants(category: string, treatment: string): readonly string[] | null {
  const c = categoryOf(category);
  if (!c || !Object.hasOwn(c, treatment)) return null;
  return c[treatment];
}

/** Every treatment key except OTHER, across all categories. */
export function allCatalogTreatments(): string[] {
  return TREATMENT_CATEGORIES.flatMap((c) => catalogTreatments(c)).filter(
    (t) => t !== OTHER_TREATMENT,
  );
}

/** Every variant key across all treatments, deduplicated. */
export function allCatalogVariants(): string[] {
  const out = new Set<string>();
  for (const c of TREATMENT_CATEGORIES)
    for (const t of catalogTreatments(c)) for (const v of catalogVariants(c, t) ?? []) out.add(v);
  return [...out];
}

/**
 * Whether this combination is one the catalog offers.
 *
 * A treatment with variants needs exactly one of them (a "crown" with no
 * material is the comparison this feature exists to prevent); a treatment
 * without variants must not carry one. OTHER needs the clinic's own wording.
 */
export function isCatalogItem(item: {
  category: string;
  treatment: string;
  variant?: string | null;
  customLabel?: string | null;
}): boolean {
  const c = categoryOf(item.category);
  if (!c || !Object.hasOwn(c, item.treatment)) return false;
  const variants = c[item.treatment];
  const variant = item.variant ?? null;
  if (variants ? !variant || !variants.includes(variant) : variant !== null) return false;
  if (item.treatment === OTHER_TREATMENT) {
    const label = item.customLabel?.trim() ?? "";
    return label.length > 0 && label.length <= CUSTOM_LABEL_MAX;
  }
  return true;
}

/** Ground transport a quote can cover. Labels: labels.transfers. */
export const QUOTE_TRANSFERS = ["AIRPORT_HOTEL", "HOTEL_CLINIC"] as const;
export type QuoteTransfer = (typeof QUOTE_TRANSFERS)[number];

export const QUOTE_LIMITS = {
  maxItems: 30,
  maxQuantity: 99,
  /** Per unit, per subtotal and per final price, in major units. */
  maxPriceMajor: 1_000_000,
  maxFlightTickets: 20,
  maxAttachments: 5,
  attachmentMaxMB: 10,
} as const;
