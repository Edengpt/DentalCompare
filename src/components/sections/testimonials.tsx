import type { Dictionary } from "@/i18n/get-dictionary";

export function Testimonials({ t }: { t: Dictionary["testimonials"] }) {
  const testimonials = [
    {
      quote: t.oneQuote,
      name: t.oneName,
      location: t.oneLocation,
      savings: t.oneSavings,
      treatment: t.oneTreatment,
    },
    {
      quote: t.twoQuote,
      name: t.twoName,
      location: t.twoLocation,
      savings: t.twoSavings,
      treatment: t.twoTreatment,
    },
    {
      quote: t.threeQuote,
      name: t.threeName,
      location: t.threeLocation,
      savings: t.threeSavings,
      treatment: t.threeTreatment,
    },
  ];

  return (
    <section id="testimonials" className="bg-muted/40 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow justify-center">{t.eyebrow}</p>
          <h2 className="font-display text-foreground mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {t.title}
          </h2>
          <p className="text-muted-foreground mt-5 text-lg text-pretty">
            {t.subtitle}
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3 lg:mt-20">
          {testimonials.map((item, i) => (
            <figure
              key={item.name}
              className={`bg-card ring-border/60 relative flex flex-col rounded-3xl p-8 ring-1 transition-all hover:shadow-lg ${
                i === 1 ? "md:mt-12" : ""
              }`}
            >
              {/* Decorative quote mark */}
              <span
                aria-hidden="true"
                className="font-display text-teal/15 absolute end-6 top-2 text-7xl leading-none select-none"
              >
                &ldquo;
              </span>

              <blockquote className="text-foreground relative flex-1 text-base leading-relaxed">
                {item.quote}
              </blockquote>

              <div className="border-border/60 mt-8 flex items-end justify-between gap-4 border-t pt-6">
                <figcaption>
                  <div className="text-foreground font-semibold">{item.name}</div>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {item.location} ✦ {item.treatment}
                  </div>
                </figcaption>
                <div className="text-end">
                  <div className="text-muted-foreground text-[10px] tracking-wider uppercase">
                    {t.savedLabel}
                  </div>
                  <div className="font-display text-teal-deep text-xl leading-none font-bold">
                    {item.savings}
                  </div>
                </div>
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
