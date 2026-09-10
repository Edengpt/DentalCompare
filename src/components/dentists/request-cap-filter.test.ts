import { describe, it, expect } from "vitest";
import { applyRequestCapFloor } from "./request-cap-filter";
import type { PublicDentistWithCapStatus } from "@/lib/dentist-public";

// Minimal fixture — only `id` and `isAtCap` matter to this function; the rest
// of PublicDentistWithCapStatus's fields are irrelevant to its logic, so a
// cast keeps these fixtures readable instead of filling in every field.
function d(id: string, isAtCap: boolean): PublicDentistWithCapStatus {
  return { id, isAtCap } as PublicDentistWithCapStatus;
}

describe("applyRequestCapFloor", () => {
  it("returns an empty array unchanged", () => {
    expect(applyRequestCapFloor([])).toEqual([]);
  });

  it("drops capped clinics when 5+ non-capped ones remain", () => {
    const input = [d("a", false), d("b", false), d("c", false), d("d", false), d("e", false), d("f", true)];
    const result = applyRequestCapFloor(input);
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("backfills from capped clinics, in order, to reach the floor of 5", () => {
    const input = [d("a", false), d("b", false), d("c", true), d("d", true), d("e", true), d("f", true)];
    const result = applyRequestCapFloor(input);
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("when fewer than 5 clinics exist in total, returns all of them (floor never exceeds the set size)", () => {
    const input = [d("a", false), d("b", true), d("c", true)];
    const result = applyRequestCapFloor(input);
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("when already at exactly the floor with no capped clinics, returns them unchanged", () => {
    const input = [d("a", false), d("b", false), d("c", false), d("d", false), d("e", false)];
    const result = applyRequestCapFloor(input);
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("all clinics capped, fewer than 5 total: returns all of them anyway (floor is not a promise of non-capped results)", () => {
    const input = [d("a", true), d("b", true)];
    const result = applyRequestCapFloor(input);
    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
