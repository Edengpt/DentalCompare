import { describe, it, expect } from "vitest";
import he from "./dictionaries/he";
import en from "./dictionaries/en";

/**
 * TypeScript already fails the build on a MISSING key, because en is typed
 * `typeof he`. This catches what types cannot: a key that exists but was left
 * blank, which is how a half-finished translation slips through review looking
 * complete.
 */
function emptyPaths(value: unknown, path = ""): string[] {
  if (typeof value === "string") return value.trim() ? [] : [path];
  if (Array.isArray(value)) return value.flatMap((v, i) => emptyPaths(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => emptyPaths(v, path ? `${path}.${k}` : k));
  }
  return [];
}

describe("dictionaries", () => {
  it("has no blank strings in Hebrew", () => {
    expect(emptyPaths(he)).toEqual([]);
  });

  it("has no blank strings in English", () => {
    expect(emptyPaths(en)).toEqual([]);
  });

  it("has an English string for every Hebrew one", () => {
    // Belt and braces alongside the type: catches a key deleted from he but
    // left in en, which the type alone permits.
    const paths = (v: unknown, p = ""): string[] => {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        return Object.entries(v).flatMap(([k, val]) => paths(val, p ? `${p}.${k}` : k));
      }
      return [p];
    };
    expect(paths(en).sort()).toEqual(paths(he).sort());
  });
});
