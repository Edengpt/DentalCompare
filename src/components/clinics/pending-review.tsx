"use client";

import { AlertTriangle, CheckCircle2, Clock, Circle, Upload } from "lucide-react";
import { LocaleLink as Link } from "@/i18n/locale-link";
import { useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { cn } from "@/lib/utils";

/** A document the admin sent back, with the reason the clinic was given. */
export type ReturnedDocument = { kind: string; reason: string | null };

/**
 * Where a clinic's application stands and what happens next.
 *
 * Shown the moment the clinic submits, and again at the top of its own area for
 * as long as it is unapproved. A bare "thank you" or a checklist of red crosses
 * leaves the clinic guessing whether anything is happening — and a clinic that
 * guesses "nothing" registers again, or gives up.
 *
 * When a document was sent back, the middle step turns into the clinic's to-do,
 * with the reasons and the way to upload a replacement.
 */
export function PendingReview({
  email,
  trialDays,
  returned = [],
  replaceHref = null,
}: {
  email: string;
  trialDays: number;
  returned?: ReturnedDocument[];
  /** The tokenised replacement page, when one has been issued. */
  replaceHref?: string | null;
}) {
  const t = useT();
  const needsDocument = returned.length > 0;
  const steps = [
    { state: "done", title: t.clinics.pendingStepSent, note: t.clinics.pendingStepSentNote },
    needsDocument
      ? { state: "attention", title: t.clinics.pendingStepFix, note: t.clinics.pendingStepFixNote }
      : {
          state: "current",
          title: t.clinics.pendingStepReview,
          note: t.clinics.pendingStepReviewNote,
        },
    {
      state: "next",
      title: t.clinics.pendingStepLive,
      note: format(t.clinics.pendingStepLiveNote, { trialDays }),
    },
  ] as const;

  return (
    <div className="border-border/60 bg-card mx-auto max-w-xl rounded-3xl border p-8 sm:p-10">
      <div
        className={cn(
          "inline-flex h-14 w-14 items-center justify-center rounded-full",
          needsDocument ? "bg-highlight/30 text-on-highlight" : "bg-teal-deep/10 text-teal-deep",
        )}
      >
        {needsDocument ? <AlertTriangle className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
      </div>
      <h2 className="font-display text-foreground mt-5 text-2xl font-bold">
        {needsDocument ? t.clinics.pendingFixTitle : t.clinics.pendingTitle}
      </h2>
      <p className="text-muted-foreground mt-3 text-pretty">
        {needsDocument ? t.clinics.pendingFixIntro : t.clinics.pendingIntro}
      </p>

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
              {s.state === "attention" && (
                <span className="bg-highlight text-on-highlight flex h-6 w-6 items-center justify-center rounded-full">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
              )}
              {s.state === "next" && <Circle className="text-border h-6 w-6" />}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-semibold",
                  s.state === "next" && "text-muted-foreground",
                  s.state === "attention" && "text-foreground",
                  (s.state === "done" || s.state === "current") && "text-foreground",
                )}
                aria-current={s.state === "current" || s.state === "attention" ? "step" : undefined}
              >
                {s.title}
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm">{s.note}</p>

              {s.state === "attention" && (
                <div className="mt-3 space-y-3">
                  <ul className="space-y-2">
                    {returned.map((doc) => (
                      <li
                        key={doc.kind}
                        className="border-highlight bg-highlight/10 rounded-xl border px-3.5 py-2.5 text-sm"
                      >
                        <span className="text-foreground font-semibold">{doc.kind}</span>
                        {doc.reason && (
                          <span className="text-muted-foreground mt-0.5 block whitespace-pre-wrap">
                            {doc.reason}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {replaceHref ? (
                    <Link
                      href={replaceHref}
                      className="bg-coral hover:bg-coral/90 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white"
                    >
                      <Upload className="h-4 w-4" />
                      {t.clinics.dashDocReplace}
                    </Link>
                  ) : (
                    // The admin rejected a document but no link was issued yet —
                    // it goes out by email with the rejection. Say so instead of
                    // showing a button that leads nowhere.
                    <p className="text-muted-foreground text-xs">{t.clinics.pendingFixByEmail}</p>
                  )}
                </div>
              )}
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
