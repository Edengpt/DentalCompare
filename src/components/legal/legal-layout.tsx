"use client";

import type { ReactNode } from "react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { useT } from "@/i18n/provider";

/**
 * Shared shell for the static legal/policy pages (terms, privacy, cookies,
 * accessibility, refunds). Keeps them visually consistent with the rest of the
 * site and centralizes the reading-width + spacing so each page file is just
 * content.
 */
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  const t = useT();

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-border/60 bg-muted/30 border-b py-12 lg:py-16">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <h1 className="font-display text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
              {title}
            </h1>
            {updated && (
              <p className="text-muted-foreground mt-3 text-sm">
                {t.legal.updatedLabel} {updated}
              </p>
            )}
          </div>
        </section>
        <article className="mx-auto max-w-3xl space-y-9 px-6 py-12 leading-relaxed lg:px-10 lg:py-16">
          {children}
        </article>
      </main>
      <Footer />
    </>
  );
}

/** A titled section within a legal page. */
export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-foreground text-2xl font-bold">{heading}</h2>
      {children}
    </section>
  );
}

/** Body paragraph. */
export function P({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

/** Bulleted list. */
export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="text-muted-foreground list-disc space-y-1.5 ps-5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

/**
 * A highlighted placeholder for details only the operator can supply (legal
 * entity name, ID, address, accessibility coordinator). Visually obvious so
 * nothing ships to production half-filled.
 */
export function Ph({ children }: { children: ReactNode }) {
  return (
    <mark className="bg-highlight/30 text-on-highlight rounded px-1.5 py-0.5 font-semibold">
      «{children}»
    </mark>
  );
}
