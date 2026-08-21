import type { Dictionary } from "@/i18n/get-dictionary";

export function Benefits({ t }: { t: Dictionary["benefits"] }) {
  const benefits = [
    { number: "I", title: t.oneTitle, description: t.oneDescription },
    { number: "II", title: t.twoTitle, description: t.twoDescription },
    { number: "III", title: t.threeTitle, description: t.threeDescription },
    { number: "IV", title: t.fourTitle, description: t.fourDescription },
  ];

  return (
    <section id="benefits" className="bg-background py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-16 lg:grid-cols-[1fr_2fr] lg:items-start lg:gap-20">
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow">{t.eyebrow}</p>
            <h2 className="font-display text-foreground mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              {t.title}
            </h2>
            <p className="text-muted-foreground mt-5 leading-relaxed text-pretty">
              {t.subtitle}
            </p>
          </div>

          <ul className="divide-border/60 divide-y">
            {benefits.map((b) => (
              <li
                key={b.number}
                className="group grid grid-cols-[auto_1fr] gap-6 py-8 first:pt-0 last:pb-0 sm:gap-10"
              >
                <span className="font-display text-teal-deep/50 group-hover:text-teal-deep text-3xl leading-none font-bold transition-colors sm:text-4xl">
                  {b.number}
                </span>
                <div>
                  <h3 className="font-display text-foreground text-2xl leading-tight font-bold">
                    {b.title}
                  </h3>
                  <p className="text-muted-foreground mt-3 leading-relaxed">{b.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
