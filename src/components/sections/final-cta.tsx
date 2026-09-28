import { LocaleLink as Link } from "@/i18n/locale-link";
import { Show } from "@clerk/nextjs";
import { ForwardArrow } from "@/components/ui/forward-arrow";
import type { Dictionary } from "@/i18n/get-dictionary";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FinalCta({ t }: { t: Dictionary["finalCta"] }) {
  return (
    <section className="bg-teal-deep relative overflow-hidden py-24 lg:py-32">
      {/* atmosphere */}
      <div
        aria-hidden="true"
        className="bg-highlight/20 absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full blur-3xl"
      />
      <div
        aria-hidden="true"
        className="bg-teal/30 absolute -right-32 -bottom-40 h-[420px] w-[420px] rounded-full blur-3xl"
      />

      <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-10">
        <p className="eyebrow text-cream/70 before:bg-cream/40 justify-center">{t.eyebrow}</p>
        <h2 className="font-display text-cream mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          {t.title}
        </h2>
        <p className="text-cream/80 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-pretty">
          {t.subtitle}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {/* Auth-aware CTA — see hero.tsx: a signed-in user sent to /sign-up is
              bounced back by Clerk, so route them into the app instead. */}
          <Show when="signed-out">
            <Link
              href="/sign-up"
              className={cn(
                buttonVariants(),
                "bg-accent hover:bg-accent/90 text-accent-foreground inline-flex h-14 items-center gap-2 rounded-full px-8 text-base font-semibold shadow-2xl shadow-black/20",
              )}
            >
              {t.cta}
              <ForwardArrow className="h-5 w-5" />
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants(),
                "bg-accent hover:bg-accent/90 text-accent-foreground inline-flex h-14 items-center gap-2 rounded-full px-8 text-base font-semibold shadow-2xl shadow-black/20",
              )}
            >
              {t.cta}
              <ForwardArrow className="h-5 w-5" />
            </Link>
          </Show>

          <Link
            href="#faq"
            className="text-cream/80 hover:text-cream px-2 text-sm font-medium underline-offset-4 transition-colors hover:underline"
          >
            {t.secondaryCta}
          </Link>
        </div>

        <p className="text-cream/50 mt-8 text-xs">
          {t.reassurance}
        </p>
      </div>
    </section>
  );
}
