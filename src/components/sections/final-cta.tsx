import { LocaleLink as Link } from "@/i18n/locale-link";
import { Show } from "@clerk/nextjs";
import { ForwardArrow } from "@/components/ui/forward-arrow";
import type { Dictionary } from "@/i18n/get-dictionary";

export function FinalCta({ t }: { t: Dictionary["finalCta"] }) {
  const button =
    "bg-highlight text-on-highlight hover:bg-highlight/90 focus-visible:outline-cream inline-flex h-14 shrink-0 items-center gap-2 rounded-lg px-8 text-base font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <section className="bg-teal-deep py-14 sm:py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 md:flex-row md:items-center md:justify-between lg:px-10">
        <div>
          <h2 className="font-display text-cream text-2xl font-bold text-balance sm:text-3xl">
            {t.title}
          </h2>
          <p className="text-cream/80 mt-2 text-sm sm:text-base">{t.subtitle}</p>
        </div>

        {/* Auth-aware CTA — a signed-in user sent to /sign-up is bounced back by
            Clerk, so route them into the app instead. */}
        <Show when="signed-out">
          <Link href="/sign-up" className={button}>
            {t.cta}
            <ForwardArrow className="h-5 w-5" />
          </Link>
        </Show>
        <Show when="signed-in">
          <Link href="/request/new" className={button}>
            {t.cta}
            <ForwardArrow className="h-5 w-5" />
          </Link>
        </Show>
      </div>
    </section>
  );
}
