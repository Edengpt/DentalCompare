"use client";

import { Info } from "lucide-react";
import { LocaleLink } from "@/i18n/locale-link";
import { useT } from "@/i18n/provider";

/**
 * The short medical disclaimer, shown where a patient is about to rely on
 * something (sending a request, comparing quotes, choosing clinics). The full
 * text lives on /medical-disclaimer.
 */
export function MedicalDisclaimerNote({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <p
      className={`border-border/60 bg-muted/40 text-muted-foreground flex gap-2.5 rounded-lg border px-4 py-3 text-xs leading-relaxed ${className}`}
    >
      <Info className="text-teal-deep mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        {t.legal.disclaimerShort}{" "}
        <LocaleLink
          href="/medical-disclaimer"
          className="text-teal-deep font-semibold underline underline-offset-4"
        >
          {t.legal.disclaimerReadMore}
        </LocaleLink>
      </span>
    </p>
  );
}
