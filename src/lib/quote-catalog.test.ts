import { describe, it, expect } from "vitest";
import he from "@/i18n/dictionaries/he";
import {
  QUOTE_TRANSFERS,
  allCatalogVariants,
  TREATMENT_CATEGORIES,
  catalogTreatments,
  catalogVariants,
  isCatalogItem,
  allCatalogTreatments,
} from "./quote-catalog";

describe("TREATMENT_CATALOG", () => {
  it("has globally unique treatment keys apart from OTHER, so labels can be flat", () => {
    const keys = allCatalogTreatments();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ends every category with OTHER", () => {
    for (const c of TREATMENT_CATEGORIES) expect(catalogTreatments(c).at(-1)).toBe("OTHER");
  });

  it("narrows crowns to a material", () => {
    expect(catalogVariants("RESTORATIVE", "CROWN")).toEqual(["ZIRCONIA", "PFM", "EMAX"]);
    expect(catalogVariants("RESTORATIVE", "BRIDGE")).toBeNull();
    expect(catalogVariants("NOPE", "CROWN")).toBeNull();
  });
});

describe("isCatalogItem", () => {
  it("accepts a plain treatment", () => {
    expect(isCatalogItem({ category: "SURGICAL", treatment: "IMPLANT" })).toBe(true);
  });

  it("requires a variant exactly when the treatment lists them", () => {
    expect(isCatalogItem({ category: "RESTORATIVE", treatment: "CROWN" })).toBe(false);
    expect(
      isCatalogItem({ category: "RESTORATIVE", treatment: "CROWN", variant: "ZIRCONIA" }),
    ).toBe(true);
    expect(isCatalogItem({ category: "RESTORATIVE", treatment: "CROWN", variant: "GOLD" })).toBe(
      false,
    );
    expect(isCatalogItem({ category: "PREVENTIVE", treatment: "FILLING", variant: "EMAX" })).toBe(
      false,
    );
  });

  it("rejects a treatment filed under the wrong category", () => {
    expect(isCatalogItem({ category: "COSMETIC", treatment: "IMPLANT" })).toBe(false);
  });

  it("does not treat prototype keys as catalog entries", () => {
    expect(isCatalogItem({ category: "constructor", treatment: "IMPLANT" })).toBe(false);
    expect(isCatalogItem({ category: "SURGICAL", treatment: "toString" })).toBe(false);
  });

  it("needs the clinic's own wording for OTHER", () => {
    expect(isCatalogItem({ category: "SURGICAL", treatment: "OTHER" })).toBe(false);
    expect(isCatalogItem({ category: "SURGICAL", treatment: "OTHER", customLabel: "  " })).toBe(
      false,
    );
    expect(
      isCatalogItem({ category: "SURGICAL", treatment: "OTHER", customLabel: "CT scan" }),
    ).toBe(true);
    expect(
      isCatalogItem({ category: "SURGICAL", treatment: "OTHER", customLabel: "x".repeat(81) }),
    ).toBe(false);
  });
});

describe("catalog labels", () => {
  // Other locales are held to he's keys by their `typeof he` annotation, and to
  // non-blank values by dictionaries.test.ts — so covering he covers all seven.
  it("has a label for every category, treatment, variant and transfer", () => {
    const l = he.labels;
    for (const c of TREATMENT_CATEGORIES) expect(l.quoteCategories).toHaveProperty(c);
    for (const t of [...allCatalogTreatments(), "OTHER"])
      expect(l.quoteTreatments).toHaveProperty(t);
    for (const v of allCatalogVariants()) expect(l.quoteVariants).toHaveProperty(v);
    for (const k of QUOTE_TRANSFERS) expect(l.transfers).toHaveProperty(k);
  });
});
