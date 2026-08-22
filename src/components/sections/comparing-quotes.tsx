import type { Dictionary } from "@/i18n/get-dictionary";
import { Receipt, CalendarClock, ShieldCheck, Scale } from "lucide-react";

/**
 * The section that covers the moment the rest of the page skips.
 *
 * "How it works" explains the mechanics and "Benefits" explains why to use the
 * site; both stop at the point the quotes land in the inbox. That is where the
 * patient is left alone with three prices that are not comparable, which is the
 * hardest part of the whole journey.
 *
 * The four things it teaches are the four fields the platform already collects
 * from every clinic (Quote.includes, tripsRequired / daysPerTrip,
 * warrantyYears). This is a description of what the product does, not copy
 * invented around it — which is also why it stays honest as the product grows.
 */
export function ComparingQuotes({ t }: { t: Dictionary["comparingQuotes"] }) {
  const points = [
    { icon: Receipt, title: t.oneTitle, description: t.oneDescription },
    { icon: CalendarClock, title: t.twoTitle, description: t.twoDescription },
    { icon: ShieldCheck, title: t.threeTitle, description: t.threeDescription },
    { icon: Scale, title: t.fourTitle, description: t.fourDescription },
  ];

  return (
    <section id="comparing-quotes" className="bg-muted/40 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow justify-center">{t.eyebrow}</p>
          <h2 className="font-display text-foreground mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {t.title}
          </h2>
          <p className="text-muted-foreground mt-5 text-lg text-pretty">{t.subtitle}</p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:mt-20">
          {points.map((point) => (
            <div
              key={point.title}
              className="bg-card ring-border/60 flex flex-col rounded-3xl p-8 ring-1 transition-all hover:shadow-lg"
            >
              <point.icon className="text-teal-deep h-7 w-7" aria-hidden="true" />
              <h3 className="font-display text-foreground mt-5 text-xl leading-tight font-bold">
                {point.title}
              </h3>
              <p className="text-muted-foreground mt-3 leading-relaxed">{point.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
