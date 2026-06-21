import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const metadata = {
  title: "אזור אישי",
};

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const greetingName = user?.firstName ?? user?.username ?? "ברוך הבא";

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
          <p className="eyebrow">אזור אישי</p>
          <h1 className="font-display mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            שלום {greetingName} 👋
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-lg text-pretty">
            כאן יופיעו כל בקשות המחיר שלך, סטטוס הטיפול והקבצים שהעלית. עוד אין בקשות פעילות — כדי
            להתחיל, צרו את הבקשה הראשונה שלכם.
          </p>

          <div className="border-border/60 bg-card mt-12 rounded-3xl border border-dashed p-12 text-center">
            <p className="text-muted-foreground text-sm">
              כפתור &ldquo;יצירת בקשה חדשה&rdquo; יתווסף בחלק 5–7 של הפיתוח.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
