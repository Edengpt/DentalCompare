import { describe, it, expect } from "vitest";
import { negotiateLocale, isUnsupportedLocaleSegment } from "./locale-negotiation";

describe("negotiateLocale", () => {
  it("prefers an explicit cookie choice over the browser header", () => {
    // A visitor who switched language on purpose must not be overridden by
    // whatever their browser advertises.
    expect(negotiateLocale("en", "he-IL,he;q=0.9")).toBe("en");
    expect(negotiateLocale("he", "en-GB,en;q=0.9")).toBe("he");
  });

  it("falls back to the browser header when there is no cookie", () => {
    expect(negotiateLocale(undefined, "en-GB,en;q=0.9")).toBe("en");
    expect(negotiateLocale(undefined, "he-IL,he;q=0.9,en;q=0.8")).toBe("he");
  });

  it("takes the first supported language, ignoring unsupported ones ahead of it", () => {
    expect(negotiateLocale(undefined, "de-DE,de;q=0.9,en;q=0.8")).toBe("en");
  });

  it("falls back to Hebrew when nothing matches", () => {
    expect(negotiateLocale(undefined, "de-DE,de;q=0.9")).toBe("he");
    expect(negotiateLocale(undefined, null)).toBe("he");
    expect(negotiateLocale(undefined, "")).toBe("he");
  });

  it("ignores a malformed cookie rather than trusting it", () => {
    expect(negotiateLocale("klingon", "en-GB")).toBe("en");
    expect(negotiateLocale("", "en-GB")).toBe("en");
  });
});

describe("isUnsupportedLocaleSegment", () => {
  it("flags a language-shaped segment we don't serve", () => {
    expect(isUnsupportedLocaleSegment("de")).toBe(true);
    expect(isUnsupportedLocaleSegment("fr")).toBe(true);
  });

  it("does not flag supported locales", () => {
    expect(isUnsupportedLocaleSegment("he")).toBe(false);
    expect(isUnsupportedLocaleSegment("en")).toBe(false);
  });

  it("does not flag ordinary path segments", () => {
    // Two-letter route names would be a false positive; there are none today,
    // but the check must not fire on real paths.
    expect(isUnsupportedLocaleSegment("request")).toBe(false);
    expect(isUnsupportedLocaleSegment("admin")).toBe(false);
    expect(isUnsupportedLocaleSegment("")).toBe(false);
  });
});
