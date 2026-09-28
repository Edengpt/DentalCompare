import { describe, it, expect } from "vitest";
import { parseStartPreferences, serializeStartPreferences } from "./start-preferences";

describe("parseStartPreferences", () => {
  it("round-trips a valid choice", () => {
    const raw = serializeStartPreferences({ specialty: "Implantology", scope: "ANY" });
    expect(parseStartPreferences(raw)).toEqual({ specialty: "Implantology", scope: "ANY" });
  });

  it("returns nothing for a missing or broken cookie", () => {
    expect(parseStartPreferences(undefined)).toEqual({ specialty: null, scope: null });
    expect(parseStartPreferences("")).toEqual({ specialty: null, scope: null });
    expect(parseStartPreferences("{not json")).toEqual({ specialty: null, scope: null });
    expect(parseStartPreferences("42")).toEqual({ specialty: null, scope: null });
  });

  it("drops values it does not recognise, field by field", () => {
    expect(parseStartPreferences(JSON.stringify({ specialty: "Brain", scope: "ANY" }))).toEqual({
      specialty: null,
      scope: "ANY",
    });
    // SELECTED needs a country list the homepage never asks for.
    expect(
      parseStartPreferences(JSON.stringify({ specialty: "Orthodontics", scope: "SELECTED" })),
    ).toEqual({ specialty: "Orthodontics", scope: null });
  });
});
