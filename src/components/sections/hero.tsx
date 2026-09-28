import { LocaleLink as Link } from "@/i18n/locale-link";
import { Show } from "@clerk/nextjs";
import { Upload, Users, Wallet, PhoneOff } from "lucide-react";
import { ForwardArrow } from "@/components/ui/forward-arrow";
import type { Dictionary } from "@/i18n/get-dictionary";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeroVideo } from "./hero-video";
import type { Locale } from "@/i18n/config";
import type { HomepageStats } from "@/lib/homepage-stats";
import { formatMoney } from "@/lib/money";

export function Hero({
  t,
  stats,
  locale,
}: {
  t: Dictionary["hero"];
  stats: HomepageStats;
  locale: Locale;
}) {
  const benefits = [
    { icon: Upload, text: t.benefitUpload },
    { icon: Users, text: t.benefitSend },
    { icon: Wallet, text: t.benefitCompare },
    { icon: PhoneOff, text: t.benefitNoCalls },
  ];

  // Each tile falls back on its own. The clinic count crosses its floor months
  // before ten requests have carried two quotes each, and there is no reason
  // for the first to wait on the third.
  //
  // A measured figure is always accompanied by the label that describes what
  // was measured; the fallback swaps BOTH halves, because "48 שעות" under
  // "of requests answered within 48 hours" would read as a broken number.
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);

  const trustStats = [
    stats.clinics === null
      ? { value: t.statClinicsFallbackValue, label: t.statClinicsFallbackLabel }
      : { value: number(stats.clinics), label: t.statClinicsLabel },

    stats.responseRate === null
      ? { value: t.statResponseFallbackValue, label: t.statResponseFallbackLabel }
      : {
          value: new Intl.NumberFormat(locale, { style: "percent" }).format(
            stats.responseRate / 100,
          ),
          label: t.statResponseLabel,
        },

    stats.medianSpread === null
      ? { value: t.statSpreadFallbackValue, label: t.statSpreadFallbackLabel }
      : {
          value: formatMoney(stats.medianSpread.minor, stats.medianSpread.currency, locale),
          label: t.statSpreadLabel,
        },
  ];

  return (
    <section className="hero-video relative isolate flex min-h-[88vh] items-center overflow-hidden">
      {/* Looping background video (client component — handles iOS autoplay). */}
      <HeroVideo />

      {/* Light scrim — lets the (bright) video show through; text legibility is
          carried mostly by the text-shadow on the content below. */}
      <div
        aria-hidden="true"
        className="from-teal-deep/60 via-teal-deep/25 to-teal-deep/45 absolute inset-0 -z-10 bg-gradient-to-t"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_0%,transparent,rgba(0,0,0,0.15))]"
      />

      <div className="mx-auto w-full max-w-4xl px-6 py-24 text-center [text-shadow:0_1px_10px_rgba(0,0,0,0.45)] lg:px-10 lg:py-32">
        <p className="eyebrow text-cream/70 before:bg-cream/40 justify-center">{t.eyebrow}</p>

        <h1 className="font-display text-cream mt-6 font-bold tracking-tight text-balance">
          <span className="text-cream/80 block text-2xl font-semibold sm:text-3xl">
            {t.headlineTop}
          </span>
          <span className="mt-3 block text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
            {t.headlineMain} <span className="text-highlight">{t.headlineAccent}</span>
          </span>
        </h1>

        <ul className="mx-auto mt-8 flex max-w-xl flex-col gap-3.5 text-start">
          {benefits.map((b) => (
            <li key={b.text} className="flex items-center gap-3">
              <span className="bg-cream/10 text-highlight ring-cream/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1">
                <b.icon className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <span className="text-cream/90 text-base leading-snug sm:text-lg">{b.text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {/* Auth-aware primary CTA: a signed-in visitor must NOT be sent to
              /sign-up (Clerk bounces them back and the button looks broken). */}
          <Show when="signed-out">
            <Link
              href="/sign-up"
              className={cn(
                buttonVariants(),
                "bg-accent hover:bg-accent/90 text-accent-foreground group inline-flex h-14 items-center gap-2 rounded-lg px-8 text-base font-semibold shadow-2xl shadow-black/30 transition-all hover:shadow-black/40",
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
                "bg-accent hover:bg-accent/90 text-accent-foreground group inline-flex h-14 items-center gap-2 rounded-lg px-8 text-base font-semibold shadow-2xl shadow-black/30 transition-all hover:shadow-black/40",
              )}
            >
              {t.cta}
              <ForwardArrow className="h-5 w-5" />
            </Link>
          </Show>

          <Link
            href="#how"
            className="text-cream/90 hover:text-cream inline-flex items-center gap-1.5 px-2 text-sm font-semibold underline-offset-4 transition-colors hover:underline"
          >
            {t.secondaryCta}
          </Link>
        </div>

        <p className="text-cream/60 mt-6 text-xs">{t.reassurance}</p>

        {/* Trust strip */}
        <div className="border-cream/15 mx-auto mt-16 grid max-w-3xl gap-8 border-t pt-10 sm:grid-cols-3 sm:gap-4">
          {trustStats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-display text-cream text-3xl font-bold sm:text-4xl">{stat.value}</p>
              <p className="text-cream/70 mt-2 text-sm leading-snug">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
