import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { ArrowLeft, Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const quotePreview = [
  {
    clinic: "מרפאת השן הזהב",
    city: "תל אביב",
    treatment: "השתלה + כתר זרקוניה",
    price: "₪9,800",
    rating: "4.9",
    isLowest: true,
  },
  {
    clinic: "מרפאת חיוך זוהר",
    city: "פתח תקווה",
    treatment: "השתלה + כתר זרקוניה",
    price: "₪11,200",
    rating: "4.7",
    isLowest: false,
  },
  {
    clinic: "מרפאת השן המומחים",
    city: "מודיעין",
    treatment: "השתלה + כתר זרקוניה",
    price: "₪12,500",
    rating: "4.8",
    isLowest: false,
  },
];

const trustStats = [
  { value: "300+", label: "רופאי שיניים במאגר" },
  { value: "97%", label: "מהבקשות מקבלות מענה תוך 48 שעות" },
  { value: "₪3,400", label: "ממוצע חיסכון לטיפול" },
];

export function Hero() {
  return (
    <section className="noise-bg relative overflow-hidden">
      {/* atmospheric background blobs */}
      <div
        aria-hidden="true"
        className="bg-coral-soft/40 absolute -top-32 -right-32 h-[480px] w-[480px] rounded-full blur-3xl"
      />
      <div
        aria-hidden="true"
        className="bg-teal/15 absolute -bottom-40 left-1/4 h-[420px] w-[420px] rounded-full blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-24 lg:px-10 lg:pt-24 lg:pb-32">
        <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
          {/* Text column */}
          <div className="max-w-2xl">
            <p className="eyebrow">פלטפורמת השוואת מחירים ✦ ישראל</p>

            <h1 className="font-display text-foreground mt-6 text-5xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              השוו מחירים. <span className="text-teal-deep">חסכו אלפי שקלים.</span>
            </h1>

            <p className="text-muted-foreground mt-8 max-w-xl text-lg leading-relaxed text-pretty sm:text-xl">
              העלו פעם אחת תוכנית טיפול וצילום שיניים — אנחנו שולחים את הבקשה שלכם לעד{" "}
              <strong className="text-foreground">10 רופאי שיניים</strong> במקביל, והצעות המחיר
              חוזרות ישירות למייל. ללא שיחות טלפון, ללא לחץ.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Auth-aware primary CTA: signed-out users go to sign-up, but a
                  signed-in user must NOT be sent to /sign-up (Clerk bounces an
                  authenticated visitor straight back to home — the button looks
                  broken). Send them into the app instead. */}
              <Show when="signed-out">
                <Link
                  href="/sign-up"
                  className={cn(
                    buttonVariants(),
                    "bg-accent hover:bg-accent/90 text-accent-foreground shadow-coral/20 hover:shadow-coral/30 group inline-flex h-14 items-center gap-2 rounded-full px-8 text-base font-semibold shadow-lg transition-all hover:shadow-xl",
                  )}
                >
                  קבלו הצעות מחיר עכשיו
                  <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                </Link>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/dashboard"
                  className={cn(
                    buttonVariants(),
                    "bg-accent hover:bg-accent/90 text-accent-foreground shadow-coral/20 hover:shadow-coral/30 group inline-flex h-14 items-center gap-2 rounded-full px-8 text-base font-semibold shadow-lg transition-all hover:shadow-xl",
                  )}
                >
                  קבלו הצעות מחיר עכשיו
                  <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                </Link>
              </Show>

              <Link
                href="#how"
                className="text-foreground hover:text-teal-deep mr-2 inline-flex items-center gap-1.5 px-2 text-sm font-semibold underline-offset-4 transition-colors hover:underline"
              >
                איך זה עובד?
              </Link>
            </div>

            <p className="text-muted-foreground mt-6 text-xs">
              ₪49 חד-פעמי לבקשה ✦ ללא עמלות נסתרות ✦ ביטול בכל עת
            </p>
          </div>

          {/* Visual column — stacked quote cards */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div
              aria-hidden="true"
              className="absolute -inset-x-6 -inset-y-10 -z-10 rounded-[3rem] bg-gradient-to-br from-white via-white to-transparent opacity-60 blur-2xl"
            />

            {/* Header label above the cards */}
            <div className="text-muted-foreground mb-4 flex items-center justify-between px-2 text-xs font-medium">
              <span>הצעות מחיר שהתקבלו</span>
              <span className="font-mono">היום, 14:23</span>
            </div>

            <div className="space-y-3">
              {quotePreview.map((q, i) => (
                <div
                  key={q.clinic}
                  className="group bg-card ring-border/60 relative rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)] ring-1 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06),0_24px_48px_-16px_rgba(0,0,0,0.12)]"
                  style={{
                    marginInlineStart: `${i * 24}px`,
                    animationDelay: `${i * 100}ms`,
                  }}
                >
                  {q.isLowest && (
                    <span className="bg-teal-deep text-cream absolute start-5 -top-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                      ההצעה הזולה ביותר
                    </span>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-foreground truncate font-semibold">{q.clinic}</h3>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {q.city} ✦ {q.treatment}
                      </p>
                    </div>
                    <div className="text-end">
                      <p
                        className={`font-display text-2xl leading-none font-bold ${
                          q.isLowest ? "text-teal-deep" : "text-foreground"
                        }`}
                      >
                        {q.price}
                      </p>
                      <p className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-xs">
                        <Star className="fill-coral text-coral h-3 w-3" />
                        {q.rating}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-muted-foreground mt-5 px-2 text-center text-xs italic">
              ההפרש בין ההצעה הזולה ליקרה:{" "}
              <strong className="text-foreground not-italic">₪2,700</strong>
            </p>
          </div>
        </div>

        {/* Trust strip */}
        <div className="border-border/60 mt-20 grid gap-8 border-t pt-12 sm:grid-cols-3 sm:gap-4 lg:mt-24">
          {trustStats.map((stat) => (
            <div key={stat.label} className="text-center sm:text-start">
              <p className="font-display text-teal-deep text-3xl font-bold sm:text-4xl">
                {stat.value}
              </p>
              <p className="text-muted-foreground mt-2 text-sm leading-snug">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
