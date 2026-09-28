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
    <section id="faq" className="scroll-mt-20 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <h2 className="font-display text-foreground text-2xl font-bold sm:text-3xl">{t.eyebrow}</h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t.title}</p>

        <Accordion className="mt-4 w-full" defaultValue={["item-0"]}>
          {faqs.map((faq, i) => (
            <AccordionItem key={faq.q} value={`item-${i}`} className="border-border/60">
              <AccordionTrigger className="text-foreground py-5 text-start text-base font-semibold hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 text-sm leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="text-muted-foreground mt-6 text-sm">
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
