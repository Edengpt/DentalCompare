import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { PhoneVerification } from "@/components/request/phone-verification";
import { getOrCreateUser } from "@/server/users";

export const metadata = { title: "אימות מספר נייד" };
export const dynamic = "force-dynamic";

export default async function VerifyPhonePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { next } = await searchParams;
  // Only accept same-origin paths — a raw `next` would otherwise be an open
  // redirect straight off the back of a sign-in.
  const redirectTo = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  // getOrCreateUser reconciles Clerk's verification state, so an already-verified
  // user never sits on this screen.
  const user = await getOrCreateUser();
  if (user?.phoneVerifiedAt) redirect(redirectTo);

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-border/60 bg-muted/30 border-b py-12 lg:py-16">
          <div className="mx-auto max-w-xl px-6 lg:px-10">
            <p className="eyebrow">שלב אחרון לפני שליחה</p>
            <h1 className="font-display text-foreground mt-4 text-4xl font-bold tracking-tight text-balance">
              נאמת את מספר הנייד שלכם
            </h1>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              המרפאות חוזרות אליכם ישירות, ולכן חשוב שהמספר יהיה נכון. האימות חינמי ולוקח 30 שניות —
              לא נבקש מכם פרטי אשראי בשום שלב.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-xl px-6 py-10 lg:px-10 lg:py-14">
          <PhoneVerification redirectTo={redirectTo} />
        </div>
      </main>
      <Footer />
    </>
  );
}
