"use client";

import { Loader2, Users } from "lucide-react";
import { ForwardArrow } from "@/components/ui/forward-arrow";
import { useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { REQUEST_LIMITS } from "@/lib/constants";

type SelectionCounterProps = {
  selected: number;
  onContinue: () => void;
  isSaving?: boolean;
};

export function SelectionCounter({ selected, onContinue, isSaving }: SelectionCounterProps) {
  const t = useT();
  const { minDentists, maxDentists } = REQUEST_LIMITS;
  const canContinue = selected >= minDentists && !isSaving;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 transition-all duration-300 sm:pb-6",
        selected === 0 && "translate-y-2 opacity-0",
        selected > 0 && "translate-y-0 opacity-100",
      )}
      aria-live="polite"
    >
      <div className="bg-teal-deep text-cream pointer-events-auto flex w-full max-w-xl items-center gap-4 rounded-full px-5 py-2.5 shadow-2xl ring-1 shadow-black/25 ring-white/10">
        <div className="bg-cream/15 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          <Users className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight font-semibold">
            {format(t.selection.chosen, { selected, max: maxDentists })}
          </p>
          <p className="text-cream/70 text-[11px]">
            {canContinue ? t.selection.ready : format(t.selection.limit, { max: maxDentists })}
          </p>
        </div>

        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition-all",
            canContinue
              ? "bg-cream text-teal-deep hover:bg-cream/90"
              : "bg-cream/20 text-cream/60 cursor-not-allowed",
          )}
        >
          {isSaving ? (
            <>
              {t.selection.saving}
              <Loader2 className="h-4 w-4 animate-spin" />
            </>
          ) : (
            <>
              {t.selection.continue}
              <ForwardArrow className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
