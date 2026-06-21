import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { UploadStep } from "@/components/upload/upload-step";

export const metadata = {
  title: "העלאת מסמכים רפואיים",
};

export const dynamic = "force-dynamic";

export default async function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const user = await db.user.findUnique({ where: { clerkUserId } });
  if (!user) redirect("/sign-in");

  const request = await db.request.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      treatmentFileUrl: true,
      xrayFileUrl: true,
      status: true,
    },
  });

  if (!request || request.userId !== user.id) notFound();

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-border/60 bg-muted/30 border-b py-12 lg:py-16">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <p className="eyebrow">שלב 1 מתוך 3</p>
            <h1 className="font-display text-foreground mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              העלאת מסמכים רפואיים
            </h1>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              שני קבצים בלבד דרושים כדי שהרופאים יוכלו להציע לכם הצעת מחיר מדויקת — תוכנית הטיפול
              הקיימת וצילום עדכני.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10 lg:py-14">
          <UploadStep
            requestId={request.id}
            initialTreatmentUrl={request.treatmentFileUrl || null}
            initialXrayUrl={request.xrayFileUrl || null}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
