import { describe, it, expect } from "vitest";
import {
  formTotals,
  initialLines,
  initialTransfers,
  linesPayload,
  newLine,
  parseDiscount,
} from "./quote-form-state";

describe("quote form state", () => {
  it("starts a picked treatment at quantity 1 with no price yet", () => {
    const line = newLine({ category: "RESTORATIVE", treatment: "CROWN", variant: "EMAX" });
    expect(line).toMatchObject({
      quantity: "1",
      unitPrice: "",
      variant: "EMAX",
      customLabel: null,
    });
  });

  it("gives every line its own key, so removing one never re-keys the rest", () => {
    const a = newLine({ category: "SURGICAL", treatment: "IMPLANT" });
    const b = newLine({ category: "SURGICAL", treatment: "IMPLANT" });
    expect(a.key).not.toBe(b.key);
  });

  it("round-trips stored items into editable lines and back", () => {
    const lines = initialLines([
      {
        category: "PREVENTIVE",
        treatment: "OTHER",
        variant: null,
        customLabel: "CT scan",
        quantity: 2,
        unitPrice: 75.5,
      },
    ]);
    expect(linesPayload(lines)).toEqual([
      {
        category: "PREVENTIVE",
        treatment: "OTHER",
        variant: null,
        customLabel: "CT scan",
        quantity: 2,
        unitPriceMajor: 75.5,
      },
    ]);
  });

  it("treats an unpriced line as not ready rather than free", () => {
    const lines = [newLine({ category: "SURGICAL", treatment: "IMPLANT" })];
    expect(formTotals(lines, "", "EUR").ok).toBe(false);
    lines[0].unitPrice = "800";
    lines[0].quantity = "3";
    expect(formTotals(lines, "400", "EUR")).toMatchObject({ ok: true, finalMinor: 200000 });
  });

  it("reads an empty discount as none", () => {
    expect(parseDiscount("  ")).toBeNull();
    expect(parseDiscount("50")).toBe(50);
  });

  it("carries a legacy airport-transfer inclusion over into transfers", () => {
    expect(initialTransfers({ transfers: [], includes: ["XRAYS", "AIRPORT_TRANSFER"] })).toEqual([
      "AIRPORT_HOTEL",
    ]);
    expect(
      initialTransfers({ transfers: ["AIRPORT_HOTEL"], includes: ["AIRPORT_TRANSFER"] }),
    ).toEqual(["AIRPORT_HOTEL"]);
  });
});
