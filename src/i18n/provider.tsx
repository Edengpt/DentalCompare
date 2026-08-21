"use client";

import { createContext, useContext } from "react";
import type { Locale } from "./config";
import type he from "./dictionaries/he";

/**
 * Gives client components the strings the server already loaded.
 *
 * The whole dictionary for the active locale is passed down, rather than
 * per-component slices. It is a few kilobytes, the other locale is never sent,
 * and slicing it per namespace would mean threading a prop through every server
 * page for a saving that doesn't show up in a page-weight budget. Revisit only
 * if the dictionary grows by an order of magnitude.
 */
type Dictionary = typeof he;

const I18nContext = createContext<{ locale: Locale; t: Dictionary } | null>(null);

export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale, t: dictionary }}>{children}</I18nContext.Provider>
  );
}

function useI18n() {
  const ctx = useContext(I18nContext);
  // Throwing beats returning Hebrew: a component rendered outside the provider
  // would otherwise show one language inside an English page, which reads as a
  // translation gap rather than the wiring mistake it is.
  if (!ctx) throw new Error("useT must be used inside <I18nProvider>");
  return ctx;
}

/** The active locale's strings. */
export function useT(): Dictionary {
  return useI18n().t;
}

/** The active locale — for direction-sensitive UI and locale-aware links. */
export function useLocale(): Locale {
  return useI18n().locale;
}
