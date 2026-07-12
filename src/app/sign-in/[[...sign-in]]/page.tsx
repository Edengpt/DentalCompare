import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Logo } from "@/components/shared/logo";

export default async function SignInPage() {
  // Already signed in? Skip the form and go into the app. This also prevents the
  // "click CTA, land back on the same page" bounce for authenticated visitors.
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="bg-muted/30 flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <Logo />
      <SignIn />
    </main>
  );
}
