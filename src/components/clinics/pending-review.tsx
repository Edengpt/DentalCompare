"use client";

import { CheckCircle2, Clock, Circle } from "lucide-react";
import { useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { cn } from "@/lib/utils";

/**
 * What a clinic sees the moment it submits: where its application stands and
 * what happens next.
 *
 * A bare "thank you" leaves the clinic guessing whether anything is happening —
 * and a clinic that guesses "nothing" registers again, or gives up.
 */
export function PendingReview({ email, trialDays }: { email: string; trialDays: number }) {
  const t = useT();
  const steps = [
    { state: "done", title: t.clinics.pendingStepSent, note: t.clinics.pendingStepSentNote },
    { state: "current", title: t.clinics.pendingStepReview, note: t.clinics.pendingStepReviewNote },
    {
      state: "next",
      title: t.clinics.pendingStepLive,
      note: format(t.clinics.pendingStepLiveNote, { trialDays }),
    },
  ] as const;

  return (
    <div className="border-border/60 bg-card mx-auto max-w-xl rounded-3xl border p-8 sm:p-10">
      <div className="bg-teal-deep/10 text-teal-deep inline-flex h-14 w-14 items-center justify-center rounded-full">
        <Clock className="h-7 w-7" />
      </div>
      <h2 className="font-display text-foreground mt-5 text-2xl font-bold">
        {t.clinics.pendingTitle}
      </h2>
      <p className="text-muted-foreground mt-3 text-pretty">{t.clinics.pendingIntro}</p>

      <ol className="mt-8">
        {steps.map((s, i) => (
          <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
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
              {s.state === "done" && <CheckCircle2 className="text-teal-deep h-6 w-6" />}
              {s.state === "current" && (
                <span className="border-teal-deep bg-card flex h-6 w-6 items-center justify-center rounded-full border-2">
                  <span className="bg-teal-deep h-2.5 w-2.5 animate-pulse rounded-full" />
                </span>
              )}
              {s.state === "next" && <Circle className="text-border h-6 w-6" />}
            </span>
            <div>
              <p
                className={cn(
                  "text-sm font-semibold",
                  s.state === "next" ? "text-muted-foreground" : "text-foreground",
                )}
                aria-current={s.state === "current" ? "step" : undefined}
              >
                {s.title}
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm">{s.note}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="border-border/60 text-foreground/90 mt-8 border-t pt-5 text-sm text-pretty">
        {format(t.clinics.pendingEmail, { email })}
      </p>
    </div>
  );
}
