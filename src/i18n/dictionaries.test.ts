import { describe, it, expect } from "vitest";
import he from "./dictionaries/he";
import en from "./dictionaries/en";
import ru from "./dictionaries/ru";
import fr from "./dictionaries/fr";
import de from "./dictionaries/de";
import zh from "./dictionaries/zh";
import tr from "./dictionaries/tr";

const translations = { en, ru, fr, de, zh, tr };

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

  for (const [code, dict] of Object.entries(translations)) {
    it(`has no blank strings in ${code}`, () => {
      expect(emptyPaths(dict)).toEqual([]);
    });
  }

  it("has a string in every language for every Hebrew one", () => {
    // Belt and braces alongside the type: catches a key deleted from he but
    // left in en, which the type alone permits.
    const paths = (v: unknown, p = ""): string[] => {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        return Object.entries(v).flatMap(([k, val]) => paths(val, p ? `${p}.${k}` : k));
      }
      return [p];
    };
    for (const dict of Object.values(translations)) {
      expect(paths(dict).sort()).toEqual(paths(he).sort());
    }
  });

  it("keeps every {placeholder} of a string in every language", () => {
    // A translator dropping {count} leaves the number out of the sentence, with
    // no error anywhere: format() just has nothing to fill.
    const leaves = (v: unknown, p = ""): [string, string][] => {
      if (typeof v === "string") return [[p, v]];
      if (Array.isArray(v)) return v.flatMap((x, i) => leaves(x, `${p}[${i}]`));
      if (v && typeof v === "object") {
        return Object.entries(v).flatMap(([k, x]) => leaves(x, p ? `${p}.${k}` : k));
      }
      return [];
    };
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const reference = new Map(leaves(en));
    for (const [code, dict] of Object.entries(translations)) {
      const missing = leaves(dict).filter(
        ([path, s]) =>
          JSON.stringify(placeholders(s)) !==
          JSON.stringify(placeholders(reference.get(path) ?? "")),
      );
      expect(missing.map(([path]) => `${code}:${path}`)).toEqual([]);
    }
  });
});
