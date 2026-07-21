import { FileUp, Users, Mail } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: FileUp,
    title: "מעלים תוכנית טיפול וצילום",
    description:
      "את תוכנית הטיפול שכבר קיבלתם מרופא, ואת צילום השיניים. PDF או תמונה, עד 20MB לקובץ — וזהו.",
    detail: "1–2 דקות",
  },
  {
    number: "02",
    icon: Users,
    title: "בוחרים עד 10 רופאים",
    description:
      "מסננים לפי עיר, התמחות וקופת חולים, ובוחרים בדיוק את מי שתרצו. הבקשה נשלחת רק לרופאים שסימנתם — אפס ספאם.",
    detail: "פילטרים חכמים",
  },
  {
    number: "03",
    icon: Mail,
    title: "ההצעות מגיעות למייל",
    description:
      "כל רופא מקבל את המסמכים ומשיב אליכם הצעת מחיר כתובה. אתם משווים בנחת ובוחרים — בלי שום התחייבות.",
    detail: "תוך 24–48 שעות",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-muted/40 relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow justify-center">איך זה עובד</p>
          <h2 className="font-display text-foreground mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            שלושה שלבים — והעבודה הכי קשה היא לחכות.
          </h2>
          <p className="text-muted-foreground mt-5 text-lg text-pretty">
            בלי טפסים אינסופיים ובלי שיחות מציקות — כל התהליך במסך אחד, ומסתיים בשלוש דקות.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3 md:gap-6 lg:mt-20">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="group border-border/60 bg-card hover:border-teal/40 relative flex flex-col rounded-3xl border p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-muted-foreground/40 text-6xl leading-none font-bold">
                    {step.number}
                  </span>
                  <span className="bg-teal-deep/8 text-teal-deep group-hover:bg-teal-deep group-hover:text-cream inline-flex h-12 w-12 items-center justify-center rounded-2xl transition-colors">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>

                <h3 className="font-display text-foreground mt-8 text-2xl leading-tight font-bold">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-3 flex-1 leading-relaxed">
                  {step.description}
                </p>
                <p className="text-teal-deep mt-6 text-xs font-semibold tracking-wider uppercase">
                  ✦ {step.detail}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
