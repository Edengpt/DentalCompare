import { ShieldCheck, FileUp, Users, Mail } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";

export function HowItWorks({ t }: { t: Dictionary["howItWorks"] }) {
  const steps = [
    {
      number: "01",
      icon: FileUp,
      title: t.step1Title,
      description: t.step1Description,
      detail: t.step1Detail,
    },
    {
      number: "02",
      icon: Users,
      title: t.step2Title,
      description: t.step2Description,
      detail: t.step2Detail,
    },
    {
      number: "03",
      icon: Mail,
      title: t.step3Title,
      description: t.step3Description,
      detail: t.step3Detail,
    },
  ];

  return (
    <section id="how" className="bg-muted/40 relative py-24 lg:py-32">
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

        {/* The verified badge appears on every clinic, so on its own it reads as
            decoration. What it actually means is a property of the directory as
            a whole, and this is where a patient meets that claim first. */}
        <p className="border-border/60 bg-card text-muted-foreground mx-auto mt-12 flex max-w-2xl items-start gap-2.5 rounded-2xl border px-5 py-4 text-sm leading-relaxed">
          <ShieldCheck className="text-teal-deep mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t.verifiedPromise}
        </p>
      </div>
    </section>
  );
}
