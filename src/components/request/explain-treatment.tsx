"use client";

import { useT } from "@/i18n/provider";

import { useState } from "react";
import { Sparkles, Loader2, HelpCircle, Stethoscope, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type Result = {
  treatments: { name: string; explanation: string }[];
  questions: string[];
  isReadable: boolean;
};

type State = "idle" | "loading" | "done" | "error";

export function ExplainTreatment({ requestId }: { requestId: string }) {
  const t = useT();
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`/api/requests/${requestId}/explain`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t.explain.genericError);
        setState("error");
        return;
      }
      setResult(data as Result);
      setState("done");
    } catch {
      setError(t.explain.retryError);
      setState("error");
    }
  };

  return (
    <section>
      <h2 className="font-display text-foreground mb-3 inline-flex items-center gap-2 text-lg font-bold">
        <Sparkles className="text-teal-deep h-5 w-5" />
        {t.explain.title}
      </h2>

      {state !== "done" && (
        <div className="border-border/60 bg-card rounded-2xl border p-5">
          <p className="text-muted-foreground mb-4 text-sm">
            {t.explain.subtitle}
          </p>
          <button
            type="button"
            onClick={run}
            disabled={state === "loading"}
            className={cn(
              buttonVariants(),
              "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-11 items-center gap-2 rounded-full px-6 font-semibold",
              state === "loading" && "cursor-wait opacity-80",
            )}
          >
            {state === "loading" ? (
              <>
                {t.explain.analyzing}
                <Loader2 className="h-4 w-4 animate-spin" />
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {t.explain.cta}
              </>
            )}
          </button>

          {state === "error" && (
            <p className="text-coral mt-3 inline-flex items-center gap-1.5 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          )}
        </div>
      )}

      {state === "done" && result && (
        <div className="border-border/60 bg-card space-y-6 rounded-2xl border p-5">
          {!result.isReadable ? (
            <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4" />
              {t.explain.unreadable}
            </p>
          ) : (
            <>
              {result.treatments.length > 0 && (
                <div>
                  <h3 className="text-foreground mb-3 inline-flex items-center gap-2 text-base font-bold">
                    <Stethoscope className="text-teal-deep h-4 w-4" />
                    {t.explain.whatsIncluded}
                  </h3>
                  <ul className="space-y-3">
                    {result.treatments.map((t, i) => (
                      <li key={i} className="border-border/50 border-r-2 pr-3">
                        <p className="text-foreground text-sm font-semibold">{t.name}</p>
                        <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                          {t.explanation}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.questions.length > 0 && (
                <div>
                  <h3 className="text-foreground mb-3 inline-flex items-center gap-2 text-base font-bold">
                    <HelpCircle className="text-teal-deep h-4 w-4" />
                    {t.explain.questionsToAsk}
                  </h3>
                  <ul className="space-y-2">
                    {result.questions.map((q, i) => (
                      <li
                        key={i}
                        className="text-muted-foreground flex items-start gap-2 text-sm leading-relaxed"
                      >
                        <span className="text-teal-deep mt-0.5 font-bold">•</span>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <p className="text-muted-foreground border-border/60 border-t pt-3 text-xs">
            {t.explain.disclaimer}
          </p>
        </div>
      )}
    </section>
  );
}
