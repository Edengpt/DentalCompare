import { SignIn } from "@clerk/nextjs";
import { Logo } from "@/components/shared/logo";

export default function SignInPage() {
  return (
    <main className="bg-muted/30 flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <Logo />
      <SignIn />
    </main>
  );
}
