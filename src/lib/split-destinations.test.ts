import { describe, it, expect } from "vitest";
import { splitDestinations } from "./split-destinations";

const list = (n: number) => Array.from({ length: n }, (_, i) => `c${i + 1}`);

describe("splitDestinations", () => {
  it("returns nothing for an empty list", () => {
    expect(splitDestinations([])).toEqual({ wide: [], shown: [], hidden: [], hasMore: false });
  });

  it("puts a single country in the wide row and offers no toggle", () => {
    expect(splitDestinations(list(1))).toEqual({
      wide: ["c1"],
      shown: [],
      hidden: [],
      hasMore: false,
    });
  });

  it("shows exactly 8 without a toggle", () => {
    const r = splitDestinations(list(8));
    expect(r.wide).toEqual(["c1", "c2"]);
    expect(r.shown).toEqual(["c3", "c4", "c5", "c6", "c7", "c8"]);
    expect(r.hidden).toEqual([]);
    expect(r.hasMore).toBe(false);
  });

  it("hides the ninth and offers the toggle", () => {
    const r = splitDestinations(list(9));
    expect(r.shown).toHaveLength(6);
    expect(r.hidden).toEqual(["c9"]);
    expect(r.hasMore).toBe(true);
  });

  it("keeps order and hides 20 of 28", () => {
    const r = splitDestinations(list(28));
    expect([...r.wide, ...r.shown, ...r.hidden]).toEqual(list(28));
    expect(r.hidden).toHaveLength(20);
  });
});
