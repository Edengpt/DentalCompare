"use client";

import { useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { useT } from "@/i18n/provider";
import {
  CUSTOM_LABEL_MAX,
  OTHER_TREATMENT,
  TREATMENT_CATEGORIES,
  catalogTreatments,
  catalogVariants,
} from "@/lib/quote-catalog";
import { translateQuoteCategory } from "@/lib/labels";
import { Chip, fieldClass } from "./chip";

export type TreatmentPick = {
  category: string;
  treatment: string;
  variant: string | null;
  customLabel: string | null;
};

/**
 * Category -> treatment -> type, all by clicking. A treatment with no types is
 * added the moment it is clicked; one with types (crown material, brace kind)
 * waits for the type, so a "crown" never reaches the patient without saying
 * which crown. OTHER asks for the clinic's own wording.
 *
 * The picker stays on the chosen category after adding, because a quote often
 * needs several treatments from the same one (an implant, then a bone graft).
 */
export function TreatmentPicker({ onAdd }: { onAdd: (pick: TreatmentPick) => void }) {
  const t = useT();
  const q = t.quoteForm;
  const [category, setCategory] = useState<string | null>(null);
  const [treatment, setTreatment] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  const variants = category && treatment ? catalogVariants(category, treatment) : null;
  const isOther = treatment === OTHER_TREATMENT;

  function add(pick: TreatmentPick) {
    onAdd(pick);
    setTreatment(null);
    setCustom("");
  }

  function chooseTreatment(key: string) {
    if (!category) return;
    if (key !== OTHER_TREATMENT && !catalogVariants(category, key)) {
      add({ category, treatment: key, variant: null, customLabel: null });
      return;
    }
    setTreatment(treatment === key ? null : key);
  }

  return (
    <div className="border-border/60 space-y-4 rounded-lg border border-dashed p-4">
      <div>
        <p className="text-muted-foreground mb-2 text-xs font-semibold">{q.chooseCategory}</p>
        <div className="flex flex-wrap gap-2">
          {TREATMENT_CATEGORIES.map((c) => (
            <Chip
              key={c}
              active={category === c}
              onClick={() => {
                setCategory(category === c ? null : c);
                setTreatment(null);
              }}
            >
              {translateQuoteCategory(t.labels, c)}
            </Chip>
          ))}
        </div>
      </div>

      {category && (
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-semibold">{q.chooseTreatment}</p>
          <div className="flex flex-wrap gap-2">
            {catalogTreatments(category).map((key) => (
              <Chip key={key} active={treatment === key} onClick={() => chooseTreatment(key)}>
                {/* A one-click add shows a plus, so the clinic knows the
                    click itself adds the line. */}
                {key !== OTHER_TREATMENT && !catalogVariants(category, key) && (
                  <Plus className="me-1 inline h-3.5 w-3.5 align-[-2px]" />
                )}
                {t.labels.quoteTreatments[key as keyof typeof t.labels.quoteTreatments] ?? key}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {category && treatment && variants && (
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-semibold">{q.chooseVariant}</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <Chip
                key={v}
                active={false}
                onClick={() => add({ category, treatment, variant: v, customLabel: null })}
              >
                <Plus className="me-1 inline h-3.5 w-3.5 align-[-2px]" />
                {t.labels.quoteVariants[v as keyof typeof t.labels.quoteVariants] ?? v}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {category && isOther && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">{q.customLabel}</span>
            <input
              value={custom}
              maxLength={CUSTOM_LABEL_MAX}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                // Enter would submit the whole quote; here it means "add".
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (custom.trim())
                    add({
                      category,
                      treatment: OTHER_TREATMENT,
                      variant: null,
                      customLabel: custom,
                    });
                }
              }}
              className={fieldClass}
              placeholder={q.customLabelPlaceholder}
            />
          </label>
          <button
            type="button"
            disabled={!custom.trim()}
            onClick={() =>
              add({ category, treatment: OTHER_TREATMENT, variant: null, customLabel: custom })
            }
            className="bg-teal-deep text-cream h-12 rounded-lg px-4 text-sm font-semibold disabled:opacity-40"
          >
            {q.addTreatment}
          </button>
        </div>
      )}

      {category && (
        <button
          type="button"
          onClick={() => {
            setCategory(null);
            setTreatment(null);
          }}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          {q.back}
        </button>
      )}
    </div>
  );
}
