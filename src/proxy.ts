import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { PROTECTED_PATTERNS } from "./proxy-routes";
import { LOCALE_COOKIE, isLocale } from "./i18n/config";
import { negotiateLocale, isUnsupportedLocaleSegment } from "./lib/locale-negotiation";
import { legacyRedirect } from "./lib/canonical-host";

// Patterns live in ./proxy-routes so they can be tested without pulling Clerk
// into the node test environment. They carry an optional locale prefix — see
// the note there; getting that wrong makes the admin area public in silence.
const isProtectedRoute = createRouteMatcher([...PROTECTED_PATTERNS]);

/** Paths that must never be rewritten into a locale. */
function isLocaleExempt(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/monitoring") ||
    pathname.startsWith("/__clerk") ||
    // Anything with a file extension: icon.svg, opengraph-image.jpg, robots.txt.
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

// A year. The visitor's language choice is a preference, not a session.
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export default clerkMiddleware(async (auth, req) => {
  // The old address first: a person opening it lands on the same page at the
  // new one, signed out of nothing they could have been signed in to there.
  const moved = legacyRedirect(new URL(req.url));
  if (moved) return NextResponse.redirect(moved, 308);

  // Auth first, always. Locale handling below can redirect, and a redirect that
  // ran before the check would hand out an unauthenticated pass to a protected
  // page.
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  const { pathname } = req.nextUrl;
  if (isLocaleExempt(pathname)) return NextResponse.next();

  const [, firstSegment = ""] = pathname.split("/");

  // Already in a locale: remember the choice and carry on.
  if (isLocale(firstSegment)) {
    const res = NextResponse.next();
    if (req.cookies.get(LOCALE_COOKIE)?.value !== firstSegment) {
      res.cookies.set(LOCALE_COOKIE, firstSegment, {
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: "lax",
        path: "/",
      });
    }
    return res;
  }

  // Looks like a language we don't serve (/de/…). Let it fall through to the
  // 404 the layout raises. Redirecting to /he/de/… would 404 anyway, at a
  // misleading URL, and hide the broken link from whoever created it.
  if (isUnsupportedLocaleSegment(firstSegment)) {
    return NextResponse.next();
  }

  const locale = negotiateLocale(
    req.cookies.get(LOCALE_COOKIE)?.value,
    req.headers.get("accept-language"),
  );

  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(url);
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files (unless in search params)
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API/TRPC routes
    "/(api|trpc)(.*)",
    // Clerk auto-proxy path
    "/__clerk/:path*",
  ],
};
