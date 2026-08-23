import { describe, it, expect } from "vitest";
import { destinationCountryCodes } from "./travel-scope";

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
});
