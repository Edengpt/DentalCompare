import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { PROTECTED_PATTERNS } from "./proxy-routes";

// Patterns live in ./proxy-routes so they can be tested without pulling Clerk
// into the node test environment. They carry an optional locale prefix — see
// the note there; getting that wrong makes the admin area public in silence.
const isProtectedRoute = createRouteMatcher([...PROTECTED_PATTERNS]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
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
