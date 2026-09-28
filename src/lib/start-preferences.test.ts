import { describe, it, expect } from "vitest";
import {
  parseStartPreferences,
  serializeStartPreferences,
  travelDefaults,
} from "./start-preferences";

describe("parseStartPreferences", () => {
  it("round-trips a valid choice", () => {
    const raw = serializeStartPreferences({ specialty: "Implantology", country: "HU" });
    expect(parseStartPreferences(raw)).toEqual({ specialty: "Implantology", country: "HU" });
  });

  it("returns nothing for a missing or broken cookie", () => {
    expect(parseStartPreferences(undefined)).toEqual({ specialty: null, country: null });
    expect(parseStartPreferences("")).toEqual({ specialty: null, country: null });
    expect(parseStartPreferences("{not json")).toEqual({ specialty: null, country: null });
    expect(parseStartPreferences("42")).toEqual({ specialty: null, country: null });
  });

  it("drops values it does not recognise, field by field", () => {
    expect(parseStartPreferences(JSON.stringify({ specialty: "Brain", country: "IL" }))).toEqual({
      specialty: null,
      country: "IL",
    });
    expect(
      parseStartPreferences(JSON.stringify({ specialty: "Orthodontics", country: "israel" })),
    ).toEqual({ specialty: "Orthodontics", country: null });
  });
});

describe("travelDefaults", () => {
  const active = ["IL", "HU", "TR"];

  it("keeps the usual default when the homepage box was never used", () => {
    expect(travelDefaults(null, "IL", active)).toEqual({ scope: "LOCAL", destinations: [] });
  });

  it("maps the home country to LOCAL", () => {
    expect(travelDefaults({ specialty: null, country: "IL" }, "IL", active)).toEqual({
      scope: "LOCAL",
      destinations: [],
    });
  });

  it("maps another active country to SELECTED with it ticked", () => {
    expect(travelDefaults({ specialty: null, country: "HU" }, "IL", active)).toEqual({
      scope: "SELECTED",
      destinations: ["HU"],
    });
  });

  it("maps anywhere to ANY", () => {
    expect(travelDefaults({ specialty: null, country: null }, "IL", active)).toEqual({
      scope: "ANY",
      destinations: [],
    });
  });

  it("ignores a country that is no longer active", () => {
    expect(travelDefaults({ specialty: null, country: "GR" }, "IL", active)).toEqual({
      scope: "LOCAL",
      destinations: [],
    });
  });
});
