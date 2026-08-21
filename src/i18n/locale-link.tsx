"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useLocale } from "./provider";
import { isLocale } from "./config";

/**
 * A Link that keeps the visitor in their language.
 *
 * Every page lives under /[locale], so a bare href="/dashboard" would leave the
 * prefix off. The proxy would catch it and redirect using the cookie, so it
 * would still *work* — but at the cost of an extra round trip on every
 * navigation, and with crawlers seeing redirect chains instead of a clean
 * bilingual link graph.
 *
 * It reads the locale from context rather than taking it as a prop, so server
 * components can use it without threading params down through every page.
 *
 * External URLs, anchors and already-prefixed paths pass through untouched.
 */
export function LocaleLink({ href, ...props }: ComponentProps<typeof Link>) {
  const locale = useLocale();

  const prefixed = typeof href === "string" ? withLocale(href, locale) : href;
  return <Link href={prefixed} {...props} />;
}

function withLocale(href: string, locale: string): string {
  // Not an app path — leave it alone.
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  // API routes are never locale-prefixed.
  if (href.startsWith("/api/")) return href;

  const [, first = ""] = href.split("/");
  if (isLocale(first)) return href;

  return `/${locale}${href}`;
}
