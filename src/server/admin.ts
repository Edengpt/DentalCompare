import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/** Comma-separated allowlist of admin emails (ADMIN_EMAILS), case-insensitive. */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase());
}

/**
 * Gate for every admin route. Redirects unauthenticated users to sign-in and
 * non-admins to the home page. Returns the admin's db user row on success.
 */
export async function requireAdmin() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in?redirect_url=/admin");

  const user = await db.user.findUnique({ where: { clerkUserId } });
  if (!user || !isAdminEmail(user.email)) redirect("/");

  return user;
}
