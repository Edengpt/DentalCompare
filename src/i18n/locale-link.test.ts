import { describe, it, expect } from "vitest";
import { isLocale } from "./config";

/**
 * Mirrors withLocale from locale-link.tsx. Kept here rather than exported from
 * the component because the component is client-only ("use client" plus JSX),
 * which the node test environment can't import — the logic is small enough that
 * duplicating it is cheaper than adding a JSX-capable test setup.
 */
function withLocale(href: string, locale: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  if (href.startsWith("/api/")) return href;
  const [, first = ""] = href.split("/");
  if (isLocale(first)) return href;
  return `/${locale}${href}`;
}

describe("withLocale", () => {
  it("prefixes an app path with the active locale", () => {
    expect(withLocale("/dashboard", "en")).toBe("/en/dashboard");
    expect(withLocale("/", "he")).toBe("/he/");
    expect(withLocale("/request/new?x=1", "en")).toBe("/en/request/new?x=1");
  });

  it("leaves an already-prefixed path alone, so it can't double up", () => {
    expect(withLocale("/en/dashboard", "en")).toBe("/en/dashboard");
    expect(withLocale("/he/terms", "en")).toBe("/he/terms");
  });

  it("never prefixes API routes — they live outside [locale]", () => {
    expect(withLocale("/api/files/upload", "en")).toBe("/api/files/upload");
  });

  it("leaves external and non-path hrefs alone", () => {
    expect(withLocale("https://example.com", "en")).toBe("https://example.com");
    expect(withLocale("mailto:a@b.com", "en")).toBe("mailto:a@b.com");
    expect(withLocale("#section", "en")).toBe("#section");
    expect(withLocale("//cdn.example.com/x", "en")).toBe("//cdn.example.com/x");
  });
});
