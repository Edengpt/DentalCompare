import { describe, it, expect } from "vitest";
import { canSearchLocally, destinationCountryCodes } from "./travel-scope";

describe("destinationCountryCodes", () => {
  it("LOCAL returns the patient's own country and nothing else", () => {
    expect(destinationCountryCodes("LOCAL", [], "IL")).toEqual(["IL"]);
  });

  // The chosen countries are the destinations; wanting to fly to Istanbul does
  // not imply also wanting the clinic down the road.
  it("SELECTED returns exactly what was chosen", () => {
    expect(destinationCountryCodes("SELECTED", ["HU", "TR"], "IL")).toEqual(["HU", "TR"]);
  });

  // null rather than a list of every code. A list is a list frozen at the
  // moment it was built: a country activated tomorrow would not appear in any
  // existing request, with no error and nobody noticing.
  it("ANY returns null, meaning no country filter at all", () => {
    expect(destinationCountryCodes("ANY", [], "IL")).toBeNull();
  });

  // "I picked countries" with no countries is an unfinished form, not a request
  // to show nothing. An empty list would filter everything away and render a
  // blank screen with no explanation.
  it("SELECTED with nothing chosen falls back to local, not to empty", () => {
    expect(destinationCountryCodes("SELECTED", [], "IL")).toEqual(["IL"]);
  });

  it("SELECTED de-duplicates", () => {
    expect(destinationCountryCodes("SELECTED", ["TR", "TR", "HU"], "IL")).toEqual(["TR", "HU"]);
  });

  it("keeps the patient's own country when they chose it as a destination too", () => {
    expect(destinationCountryCodes("SELECTED", ["IL", "TR"], "IL")).toEqual(["IL", "TR"]);
  });

  // A patient from before countries were asked has none on file. "Near me"
  // means nothing then, so there is no filter rather than an empty one.
  it("LOCAL without a patient country applies no filter", () => {
    expect(destinationCountryCodes("LOCAL", [], null)).toBeNull();
  });
});

describe("destinationCountryCodes with active countries", () => {
  // A draft saved as "only in my country" while home was Israel, after the
  // patient said they now live in Brazil: an empty list helps nobody.
  it("widens LOCAL to anywhere when home has no clinics", () => {
    expect(destinationCountryCodes("LOCAL", [], "BR", new Set(["IL", "TR"]))).toBeNull();
  });

  it("keeps LOCAL when home has clinics", () => {
    expect(destinationCountryCodes("LOCAL", [], "TR", new Set(["IL", "TR"]))).toEqual(["TR"]);
  });
});

describe("canSearchLocally", () => {
  it("is true when the patient's country has active clinics", () => {
    expect(canSearchLocally("TR", new Set(["TR", "HU"]))).toBe(true);
  });

  // A patient in Brazil can now say so; "only in my country" would show nothing.
  it("is false when the patient's country has no clinics yet", () => {
    expect(canSearchLocally("BR", new Set(["TR", "HU"]))).toBe(false);
  });

  it("is false without a country", () => {
    expect(canSearchLocally(null, new Set(["TR"]))).toBe(false);
  });
});
