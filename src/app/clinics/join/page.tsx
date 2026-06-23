import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { RegistrationForm } from "@/components/clinics/registration-form";

export const metadata = {
  title: "הצטרפות מרפאות",
  description:
    "רופאי שיניים ומרפאות — הצטרפו ל-DentalCompare בחינם וקבלו לידים של מטופלים שמחפשים הצעות מחיר.",
};

export default function ClinicJoinPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-border/60 bg-muted/30 border-b py-12 lg:py-16">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <p className="eyebrow">למרפאות ורופאים</p>
            <h1 className="font-display text-foreground mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              הצטרפו למאגר וקבלו מטופלים חדשים.
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl text-lg text-pretty">
              ההרשמה חינמית — תשלמו רק על תוצאות. מטופלים שמחפשים הצעת מחיר יראו את המרפאה שלכם
              ויפנו אליכם ישירות. מלאו את הפרטים ואשרו את תנאי שיתוף הפעולה.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10 lg:py-14">
          <RegistrationForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
