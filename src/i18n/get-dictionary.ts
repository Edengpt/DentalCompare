import "server-only";
import type { Locale } from "./config";

/**
 * Loads a locale's strings on the server.
 *
 * The imports are dynamic on purpose (the pattern the bundled Next 16 i18n
 * guide uses): a request pulls only the dictionary it needs, so adding a
 * seventh language never grows what any single page loads.
 */
const dictionaries = {
  he: () => import("./dictionaries/he").then((m) => m.default),
  en: () => import("./dictionaries/en").then((m) => m.default),
};

export function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
