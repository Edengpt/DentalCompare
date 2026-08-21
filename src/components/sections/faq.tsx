import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SITE_CONFIG } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";

export function Faq({ t }: { t: Dictionary["faq"] }) {
  const faqs = [
    { q: t.q1, a: t.a1 },
    { q: t.q2, a: t.a2 },
    { q: t.q3, a: t.a3 },
    { q: t.q4, a: t.a4 },
    { q: t.q5, a: t.a5 },
    { q: t.q6, a: t.a6 },
  ];

  return (
    <section id="faq" className="bg-background py-24 lg:py-32">
      <div className="mx-auto max-w-4xl px-6 lg:px-10">
        <div className="text-center">
          <p className="eyebrow justify-center">{t.eyebrow}</p>
          <h2 className="font-display text-foreground mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {t.title}
          </h2>
        </div>

        <Accordion className="mt-14 w-full" defaultValue={["item-0"]}>
          {faqs.map((faq, i) => (
            <AccordionItem key={faq.q} value={`item-${i}`} className="border-border/60">
              <AccordionTrigger className="text-foreground py-6 text-start text-lg font-semibold hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-6 text-base leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="text-muted-foreground mt-12 text-center text-sm">
          {t.contactPrefix}{" "}
          <a
            href={`mailto:${SITE_CONFIG.supportEmail}`}
            className="text-teal-deep font-semibold underline underline-offset-4 hover:no-underline"
          >
            {t.contactLink}
          </a>
          {t.contactSuffix}
        </p>
      </div>
    </section>
  );
}
