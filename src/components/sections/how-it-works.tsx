import type { Dictionary } from "@/i18n/get-dictionary";

export function HowItWorks({ t }: { t: Dictionary["howItWorks"] }) {
  const steps = [
    { title: t.step1Title, description: t.step1Description, detail: t.step1Detail },
    { title: t.step2Title, description: t.step2Description, detail: t.step2Detail },
    { title: t.step3Title, description: t.step3Description, detail: t.step3Detail },
  ];

  return (
    <section id="how" className="scroll-mt-20 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <h2 className="font-display text-foreground text-2xl font-bold sm:text-3xl">{t.title}</h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t.subtitle}</p>

        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="border-border bg-card flex flex-col items-start rounded-lg border p-6"
            >
              <span
                aria-hidden="true"
                className="bg-teal-deep text-cream inline-flex h-8 w-8 items-center justify-center rounded-sm text-sm font-bold"
              >
                {i + 1}
              </span>
              <h3 className="font-display text-foreground mt-4 text-lg font-bold">{step.title}</h3>
              <p className="text-muted-foreground mt-2 flex-1 text-sm leading-relaxed">
                {step.description}
              </p>
              <span className="bg-teal/10 text-teal mt-4 rounded-sm px-2 py-0.5 text-xs font-semibold">
                {step.detail}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
