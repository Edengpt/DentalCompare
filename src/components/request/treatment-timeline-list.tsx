"use client";

import { Check } from "lucide-react";
import { useLocale } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { TimelineStep, TimelineStepKey } from "@/lib/treatment-timeline";

/**
 * The treatment timeline as a vertical list: done steps dated and ticked, the
 * next one pulsing, the rest waiting. Drawn the same for patient and clinic;
 * only the words differ, so each side passes its own.
 */
export function TreatmentTimelineList({
  steps,
  labels,
  next,
  byLabel,
}: {
  steps: TimelineStep[];
  labels: Record<TimelineStepKey, string>;
  /** What each not-yet-reached step is waiting for. */
  next: Record<Exclude<TimelineStepKey, "approved">, string>;
  /** Suffix naming who marked the start, from this side's point of view. */
  byLabel: (by: NonNullable<TimelineStep["by"]>) => string;
}) {
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" });

  return (
    <ol>
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className={cn(
                "absolute start-[11px] top-7 h-[calc(100%-1.5rem)] w-0.5",
                s.state === "done" ? "bg-teal-deep" : "bg-border",
              )}
            />
          )}
          <span className="relative z-10 shrink-0">
            {s.state === "done" && (
              <span className="bg-teal-deep text-cream flex h-6 w-6 items-center justify-center rounded-full">
                <Check className="h-3.5 w-3.5" />
              </span>
            )}
            {s.state === "current" && (
              <span className="border-highlight bg-card flex h-6 w-6 items-center justify-center rounded-full border-2">
                <span className="bg-highlight h-2.5 w-2.5 animate-pulse rounded-full" />
              </span>
            )}
            {s.state === "upcoming" && (
              <span className="border-border bg-card block h-6 w-6 rounded-full border-2" />
            )}
          </span>
          <div aria-current={s.state === "current" ? "step" : undefined}>
            <p
              className={cn(
                "text-sm font-semibold",
                s.state === "upcoming" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {labels[s.key]}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {s.at
                ? date.format(s.at) + (s.by ? ` ✦ ${byLabel(s.by)}` : "")
                : s.key !== "approved" && next[s.key]}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
