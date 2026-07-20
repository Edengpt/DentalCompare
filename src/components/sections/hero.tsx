import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const trustStats = [
  { value: "300+", label: "רופאי שיניים במאגר" },
  { value: "97%", label: "מהבקשות מקבלות מענה תוך 48 שעות" },
  { value: "₪3,400", label: "ממוצע חיסכון לטיפול" },
];

export function Hero() {
  return (
    <section className="hero-video relative isolate flex min-h-[88vh] items-center overflow-hidden">
      {/* Looping background video. Muted + playsInline so it autoplays on mobile;
          poster paints instantly and is also the reduced-motion fallback. */}
      <video
        className="hero-video__media absolute inset-0 -z-10 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/media/hero-clinic-poster.jpg"
        aria-hidden="true"
      >
        <source src="/media/hero-clinic.mp4" type="video/mp4" />
      </video>

      {/* Legibility scrim: a teal wash + a soft dark gradient so cream text pops. */}
      <div
        aria-hidden="true"
        className="from-teal-deep/95 via-teal-deep/70 to-teal-deep/85 absolute inset-0 -z-10 bg-gradient-to-t"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_0%,transparent,rgba(0,0,0,0.35))]"
      />

      <div className="mx-auto w-full max-w-4xl px-6 py-24 text-center lg:px-10 lg:py-32">
        <p className="eyebrow text-cream/70 before:bg-cream/40 justify-center">
          פלטפורמת השוואת מחירים ✦ ישראל
        </p>

        <h1 className="font-display text-cream mt-6 text-5xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
          השוו מחירים. <span className="text-coral">חסכו אלפי שקלים.</span>
        </h1>

        <p className="text-cream/85 mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-pretty sm:text-xl">
          העלו פעם אחת תוכנית טיפול וצילום שיניים — אנחנו שולחים את הבקשה שלכם לעד{" "}
          <strong className="text-cream">10 רופאי שיניים</strong> במקביל, והצעות המחיר חוזרות ישירות
          למייל. ללא שיחות טלפון, ללא לחץ.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {/* Auth-aware primary CTA: a signed-in visitor must NOT be sent to
              /sign-up (Clerk bounces them back and the button looks broken). */}
          <Show when="signed-out">
            <Link
              href="/sign-up"
              className={cn(
                buttonVariants(),
                "bg-accent hover:bg-accent/90 text-accent-foreground group inline-flex h-14 items-center gap-2 rounded-full px-8 text-base font-semibold shadow-2xl shadow-black/30 transition-all hover:shadow-black/40",
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
                "bg-accent hover:bg-accent/90 text-accent-foreground group inline-flex h-14 items-center gap-2 rounded-full px-8 text-base font-semibold shadow-2xl shadow-black/30 transition-all hover:shadow-black/40",
              )}
            >
              קבלו הצעות מחיר עכשיו
              <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
            </Link>
          </Show>

          <Link
            href="#how"
            className="text-cream/90 hover:text-cream inline-flex items-center gap-1.5 px-2 text-sm font-semibold underline-offset-4 transition-colors hover:underline"
          >
            איך זה עובד?
          </Link>
        </div>

        <p className="text-cream/60 mt-6 text-xs">
          ₪49 חד-פעמי לבקשה ✦ ללא עמלות נסתרות ✦ ביטול בכל עת
        </p>

        {/* Trust strip */}
        <div className="border-cream/15 mx-auto mt-16 grid max-w-3xl gap-8 border-t pt-10 sm:grid-cols-3 sm:gap-4">
          {trustStats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-display text-cream text-3xl font-bold sm:text-4xl">{stat.value}</p>
              <p className="text-cream/70 mt-2 text-sm leading-snug">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
