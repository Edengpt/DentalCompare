import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { DentistDirectory } from "@/components/dentists/dentist-directory";

export const metadata = {
  title: "ספריית רופאי שיניים",
  description:
    "עיינו במאגר רופאי השיניים שלנו וסננו לפי עיר, התמחות וקופת חולים. עד 10 רופאים בבקשה אחת.",
};

export const dynamic = "force-dynamic";

export default async function DentistsPage() {
  const dentists = await db.dentist.findMany({
    where: { isActive: true },
    // Reviewed clinics surface first; unreviewed ones fall back to experience
    // (the default 5.0 rating is hidden in the card, so we don't sort by it).
    orderBy: [{ reviewCount: "desc" }, { rating: "desc" }, { experienceYears: "desc" }],
  });

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-border/60 bg-muted/30 border-b py-12 lg:py-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <p className="eyebrow">ספריית רופאים</p>
            <h1 className="font-display text-foreground mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              בחרו את הרופאים שיתחרו על הטיפול שלכם.
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl text-lg text-pretty">
              סננו לפי מיקום, התמחות וקופת חולים. סמנו עד 10 רופאים — והבקשה שלכם תישלח לכולם בו
              זמנית.
            </p>
          </div>
        </section>

        <DentistDirectory dentists={dentists} />
      </main>
      <Footer />
    </>
  );
}
