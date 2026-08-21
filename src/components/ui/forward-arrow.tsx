"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLocale } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * The "next" arrow.
 *
 * ArrowLeft points forward in Hebrew and backward in English, so both the icon
 * and its hover nudge have to flip with the locale. Hardcoding either one gives
 * an English reader an arrow pointing away from the thing it advances to —
 * which reads as a bug rather than a translation gap.
 */
export function ForwardArrow({ className }: { className?: string }) {
  const locale = useLocale();
  const Icon = locale === "he" ? ArrowLeft : ArrowRight;
  const nudge = locale === "he" ? "group-hover:-translate-x-1" : "group-hover:translate-x-1";

  return <Icon className={cn("transition-transform", nudge, className)} aria-hidden="true" />;
}
