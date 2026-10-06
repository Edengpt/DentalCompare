import { Check } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { EXAMPLE_QUOTES, formatExampleMoney } from "@/lib/example-quotes";
import { PlayWhenVisible } from "./play-when-visible";

/** Labels the illustrations borrow from other parts of the dictionary. */
export type HowItWorksArtLabels = {
  treatmentPlan: string;
  xray: string;
  verified: string;
  price: string;
  warranty: string;
  clinics: [string, string, string];
  warranties: [string, string, string];
};

export function HowItWorks({
  t,
  art,
  locale,
}: {
  t: Dictionary["howItWorks"];
  art: HowItWorksArtLabels;
  locale: Locale;
}) {
  const steps = [
    {
      title: t.step1Title,
      description: t.step1Description,
      detail: t.step1Detail,
      illustration: <UploadArt art={art} />,
    },
    {
      title: t.step2Title,
      description: t.step2Description,
      detail: t.step2Detail,
      illustration: <ChooseArt art={art} cities={[t.artCity1, t.artCity2, t.artCity3]} />,
    },
    {
      title: t.step3Title,
      description: t.step3Description,
      detail: t.step3Detail,
      illustration: <CompareArt art={art} locale={locale} />,
    },
  ];

  return (
    <section id="how" className="scroll-mt-20 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <h2 className="font-display text-foreground text-2xl font-bold sm:text-3xl">{t.title}</h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t.subtitle}</p>

        <PlayWhenVisible>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="border-border bg-card flex flex-col items-start rounded-lg border p-5"
              >
                {/* Decorative: the step's text below says everything the picture shows. */}
                <div
                  aria-hidden="true"
                  className="bg-sand mb-5 h-40 w-full overflow-hidden rounded-md p-3"
                >
                  {step.illustration}
                </div>
                <span
                  aria-hidden="true"
                  className="bg-teal-deep text-cream inline-flex h-8 w-8 items-center justify-center rounded-sm text-sm font-bold"
                >
                  {i + 1}
                </span>
                <h3 className="font-display text-foreground mt-4 text-lg font-bold">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-2 flex-1 text-sm leading-relaxed">
                  {step.description}
                </p>
                <span className="bg-teal/10 text-teal mt-4 rounded-sm px-2 py-0.5 text-xs font-semibold">
                  {step.detail}
                </span>
              </li>
            ))}
          </ol>
        </PlayWhenVisible>
      </div>
    </section>
  );
}

/** A miniature app window: the frame every illustration sits in. */
function MiniWindow({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-card flex h-full flex-col rounded-md border text-[11px] leading-tight shadow-sm">
      <div className="border-border flex gap-1 border-b px-2 py-1.5">
        <span className="bg-border h-1.5 w-1.5 rounded-full" />
        <span className="bg-border h-1.5 w-1.5 rounded-full" />
        <span className="bg-border h-1.5 w-1.5 rounded-full" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">{children}</div>
    </div>
  );
}

/** Step 1: two drop zones, each file slides in and is ticked. */
function UploadArt({ art }: { art: HowItWorksArtLabels }) {
  const zones = [
    { label: art.treatmentPlan, file: "plan.pdf" },
    { label: art.xray, file: "xray.jpg" },
  ];
  return (
    <MiniWindow>
      {zones.map((zone, i) => (
        <div
          key={zone.file}
          className="border-border text-muted-foreground relative flex flex-1 items-center justify-center overflow-hidden rounded border border-dashed"
        >
          {zone.label}
          <div
            className="hiw-file bg-coral-soft text-teal-deep absolute inset-0 flex items-center justify-center gap-1.5 font-semibold"
            style={{ "--hiw-delay": `${i * 0.6}s` } as React.CSSProperties}
          >
            <span className="bg-teal-deep text-cream grid h-3.5 w-3.5 place-items-center rounded-full">
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            {zone.file}
          </div>
        </div>
      ))}
    </MiniWindow>
  );
}

/** Step 2: three verified clinics, ticked one after another. */
function ChooseArt({ art, cities }: { art: HowItWorksArtLabels; cities: string[] }) {
  return (
    <MiniWindow>
      {cities.map((city, i) => (
        <div
          key={city}
          className="border-border flex flex-1 items-center gap-2 border-b px-1 last:border-b-0"
        >
          <span className="border-teal-deep relative h-3.5 w-3.5 shrink-0 rounded-[3px] border-[1.5px]">
            <span
              className="hiw-tick bg-teal-deep text-cream absolute inset-0 grid place-items-center"
              style={{ "--hiw-delay": `${i * 0.5}s` } as React.CSSProperties}
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          </span>
          <span className="text-foreground flex-1 truncate font-medium">{city}</span>
          <span className="text-success truncate text-[10px] font-semibold">{art.verified}</span>
        </div>
      ))}
    </MiniWindow>
  );
}

/** Step 3: the example quotes fill a small table; the lowest price is marked. */
function CompareArt({ art, locale }: { art: HowItWorksArtLabels; locale: Locale }) {
  return (
    <MiniWindow>
      <div className="text-muted-foreground grid grid-cols-[1fr_auto_auto] gap-x-2 px-1 text-[10px] font-semibold">
        <span />
        <span>{art.price}</span>
        <span>{art.warranty}</span>
      </div>
      {EXAMPLE_QUOTES.map((quote, i) => (
        <div
          key={quote.id}
          className="hiw-row bg-sand grid flex-1 grid-cols-[1fr_auto_auto] items-center gap-x-2 rounded px-1"
          style={{ "--hiw-delay": `${i * 0.4}s` } as React.CSSProperties}
        >
          <span className="text-foreground truncate font-medium">{art.clinics[i]}</span>
          <span
            className={
              quote.lowest
                ? "bg-highlight text-on-highlight rounded px-1 font-bold tabular-nums"
                : "text-foreground px-1 tabular-nums"
            }
          >
            {formatExampleMoney(locale, quote.amount, quote.currency)}
          </span>
          <span className="text-muted-foreground tabular-nums">{art.warranties[i]}</span>
        </div>
      ))}
    </MiniWindow>
  );
}
