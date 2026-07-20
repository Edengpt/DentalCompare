import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { ArrowLeft, Upload, Users, Wallet, PhoneOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeroVideo } from "./hero-video";

const benefits = [
  { icon: Upload, text: "מעלים פעם אחת: תוכנית טיפול וצילום שיניים." },
  { icon: Users, text: "הבקשה נשלחת לעד 10 רופאים מובילים במקביל." },
  { icon: Wallet, text: "הצעות המחיר חוזרות ישירות למייל — משווים וחוסכים." },
  { icon: PhoneOff, text: "בלי שיחות טלפון, בלי התחייבות, בלי לחץ." },
];

const trustStats = [
  { value: "300+", label: "רופאי שיניים במאגר" },
  { value: "97%", label: "מהבקשות מקבלות מענה תוך 48 שעות" },
  { value: "₪3,400", label: "ממוצע חיסכון לטיפול" },
];

export function Hero() {
  return (
    <section className="hero-video relative isolate flex min-h-[88vh] items-center overflow-hidden">
      {/* Looping background video (client component — handles iOS autoplay). */}
      <HeroVideo />

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

        <h1 className="font-display text-cream mt-6 font-bold tracking-tight text-balance">
          <span className="text-cream/80 block text-2xl font-semibold sm:text-3xl">
            לא יודעים אם המחיר לטיפול השיניים הוגן?
          </span>
          <span className="mt-3 block text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
            קבלו עד 10 הצעות. <span className="text-coral">חסכו אלפי שקלים.</span>
          </span>
        </h1>

        <ul className="mx-auto mt-8 flex max-w-xl flex-col gap-3.5 text-start">
          {benefits.map((b) => (
            <li key={b.text} className="flex items-center gap-3">
              <span className="bg-cream/10 text-coral ring-cream/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1">
                <b.icon className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <span className="text-cream/90 text-base leading-snug sm:text-lg">{b.text}</span>
            </li>
          ))}
        </ul>

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
