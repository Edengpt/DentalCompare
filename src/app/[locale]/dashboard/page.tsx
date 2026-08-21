import { LocaleLink as Link } from "@/i18n/locale-link";
import { ArrowLeft, FilePlus } from "lucide-react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getOrCreateUser } from "@/server/users";
import { isAdminEmail } from "@/server/admin";
import { db } from "@/lib/db";

export const metadata = {
  title: "אזור אישי",
};

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "ממתין לתשלום",
  PAID: "שולם ונשלח",
  FAILED: "התשלום נכשל",
};

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const profile = await getOrCreateUser();
  const clerkUser = await currentUser();
  const greetingName = clerkUser?.firstName ?? clerkUser?.username ?? "ברוך הבא";
  const showAdminLink = !!profile && isAdminEmail(profile.email);

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });
  const requests = user
    ? await db.request.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          treatmentFileUrl: true,
          xrayFileUrl: true,
          _count: { select: { requestDentists: true } },
        },
      })
    : [];

  const hasRequests = requests.length > 0;

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
          <div className="flex items-center justify-between gap-4">
            <p className="eyebrow">אזור אישי</p>
            {showAdminLink && (
              <Link
                href="/admin"
                className="text-muted-foreground hover:text-teal-deep text-sm font-medium underline-offset-4 hover:underline"
              >
                פאנל ניהול ←
              </Link>
            )}
          </div>

          <div className="mt-5 flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="font-display text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
              שלום {greetingName} 👋
            </h1>
            <Link
              href="/request/new"
              className={cn(
                buttonVariants(),
                "bg-accent text-accent-foreground hover:bg-accent/90 inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold shadow-md",
              )}
            >
              <FilePlus className="h-4 w-4" />
              בקשת מחיר חדשה
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>

          {!hasRequests ? (
            <div className="border-border/60 bg-card mt-12 rounded-3xl border border-dashed p-12 text-center">
              <h2 className="font-display text-foreground text-xl font-bold">
                עוד אין בקשות פעילות
              </h2>
              <p className="text-muted-foreground mx-auto mt-3 max-w-md text-pretty">
                התחילו את הבקשה הראשונה שלכם — בחרו עד 3 רופאים, העלו את תוכנית הטיפול והצילום,
                וההצעות יגיעו אליכם למייל.
              </p>
              <Link
                href="/request/new"
                className={cn(
                  buttonVariants(),
                  "bg-teal-deep hover:bg-teal-deep/90 text-cream mt-6 inline-flex h-11 items-center gap-2 rounded-full px-6 font-semibold",
                )}
              >
                <FilePlus className="h-4 w-4" />
                להתחלת הבקשה
              </Link>
            </div>
          ) : (
            <div className="mt-12 space-y-4">
              <h2 className="font-display text-foreground text-xl font-bold">הבקשות שלי</h2>
              <ul className="divide-border/60 bg-card border-border/60 divide-y rounded-3xl border">
                {requests.map((r) => {
                  const isSent = r.status === "SENT" || r.status === "SUBMITTED";
                  const filesReady = !!r.treatmentFileUrl && !!r.xrayFileUrl;
                  // Sent requests are locked → read-only detail. Unfinished
                  // requests link back into the flow so the user can complete them.
                  const href = isSent
                    ? `/request/${r.id}`
                    : filesReady
                      ? `/request/${r.id}/dentists`
                      : `/request/${r.id}/upload`;
                  const date = new Intl.DateTimeFormat("he-IL", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(r.createdAt);
                  return (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-5"
                    >
                      <div>
                        <p className="text-foreground font-semibold">בקשה #{r.id.slice(0, 8)}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {date} ✦ סטטוס: {STATUS_LABELS[r.status]} ✦ {r._count.requestDentists}{" "}
                          רופאים
                        </p>
                      </div>
                      <Link
                        href={href}
                        className="text-teal-deep text-sm font-semibold underline-offset-4 hover:underline"
                      >
                        {isSent ? "צפייה בפרטים" : "המשך"}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
