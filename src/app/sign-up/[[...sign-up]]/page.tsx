import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Logo } from "@/components/shared/logo";

export default async function SignUpPage() {
  // A signed-in visitor has nothing to sign up for — Clerk would otherwise
  // bounce them and the CTA looks broken ("stays on the same page"). Send them
  // straight into the app instead.
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="bg-muted/30 flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <Logo />
      <SignUp />
    </main>
  );
}
