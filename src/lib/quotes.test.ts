import { describe, it, expect } from "vitest";
import {
  sortByPrice,
  cheapestDentistId,
  responseCounts,
  quotePath,
  type QuoteRow,
} from "./quotes";

const row = (dentistId: string, amountILS: number | null): QuoteRow => ({
  dentistId,
  dentistName: `Dr ${dentistId}`,
  clinicName: `Clinic ${dentistId}`,
  city: "תל אביב",
  amountILS,
  note: null,
});

describe("quote comparison helpers", () => {
  it("sorts quoted rows cheapest-first and puts un-quoted rows last", () => {
    const rows = [row("a", null), row("b", 9800), row("c", 7200)];
    expect(sortByPrice(rows).map((r) => r.dentistId)).toEqual(["c", "b", "a"]);
  });

  it("returns the cheapest quoted dentist id, or null when none quoted", () => {
    expect(cheapestDentistId([row("a", null), row("b", 9800), row("c", 7200)])).toBe("c");
    expect(cheapestDentistId([row("a", null), row("b", null)])).toBeNull();
  });

  it("counts responded vs total", () => {
    expect(responseCounts([row("a", null), row("b", 9800), row("c", 7200)])).toEqual({
      responded: 2,
      total: 3,
    });
  });

  it("builds the quote form path", () => {
    expect(quotePath("abc-123")).toBe("/quote/abc-123");
  });
});
