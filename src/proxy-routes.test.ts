import { describe, it, expect } from "vitest";
import { createRouteMatcher } from "@clerk/nextjs/server";
import { PROTECTED_PATTERNS } from "./proxy-routes";
import { locales } from "./i18n/config";

/**
 * Guards against the silent-public failure mode.
 *
 * Moving pages under src/app/[locale]/ changes every live path from `/admin` to
 * `/he/admin`. A protected-route pattern that doesn't account for the prefix
 * stops matching, `auth.protect()` is never called, and the route is served to
 * anyone — with no error, no failed build, and a page that renders perfectly.
 * Nothing else in the stack would catch that, so it is pinned here.
 *
 * Runs against Clerk's real createRouteMatcher rather than a re-implementation
 * of its path syntax, because the bug being prevented lives precisely in how
 * that syntax behaves.
 */
const matches = createRouteMatcher([...PROTECTED_PATTERNS]);

// createRouteMatcher reads request.nextUrl; this is the smallest shape it needs.
const req = (path: string) =>
  ({
    nextUrl: new URL(`https://dentalcompare.co.il${path}`),
    url: `https://dentalcompare.co.il${path}`,
  }) as never;

const PROTECTED = [
  "/dashboard",
  "/request/abc123",
  "/request/abc123/upload",
  "/verify-phone",
  "/admin",
  "/admin/clinics",
  "/clinics/dashboard",
  // The shared treatment files: a patient's treatments, a clinic's patients.
  "/dashboard/treatments/rd123",
  "/clinics/dashboard/patients",
  // A patient's name, phone and medical files are on this page.
  "/clinics/requests/rd123",
];

const PUBLIC = [
  "/",
  "/dentists",
  "/terms",
  "/privacy",
  "/clinics/join",
  "/quote/tok123",
  "/sign-in",
  // The magic-link pages exist for a clinic that has no account at all. Pulling
  // them behind auth would lock out the clinic being asked to fix a document.
  "/clinics/billing/tok123",
  "/clinics/documents/tok123",
];

describe("protected route patterns", () => {
  for (const path of PROTECTED) {
    it(`protects ${path} unprefixed and in every locale`, () => {
      expect(matches(req(path))).toBe(true);
      for (const locale of locales) expect(matches(req(`/${locale}${path}`))).toBe(true);
    });
  }

  for (const path of PUBLIC) {
    it(`leaves ${path} public in every locale`, () => {
      expect(matches(req(path))).toBe(false);
      for (const locale of locales) expect(matches(req(`/${locale}${path}`))).toBe(false);
    });
  }

  it("protects the API routes, which are never locale-prefixed", () => {
    expect(matches(req("/api/requests/abc"))).toBe(true);
    expect(matches(req("/api/admin/anything"))).toBe(true);
  });

  it("does not protect public API routes", () => {
    expect(matches(req("/api/dentists"))).toBe(false);
    expect(matches(req("/api/webhooks/clerk"))).toBe(false);
  });
});
