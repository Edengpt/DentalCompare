"use client";

import { Check, MapPin, Star } from "lucide-react";
import type { DentistModel } from "@/generated/prisma/models";
import { cn } from "@/lib/utils";
import { translateHmo, translateSpecialty } from "@/lib/labels";

type DentistCardProps = {
  dentist: DentistModel;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

function initials(name: string) {
  const parts = name
    .replace(/^ד"ר\s*/u, "")
    .trim()
    .split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("");
}

export function DentistCard({ dentist, isSelected, onToggle, disabled }: DentistCardProps) {
  return (
    <article
      className={cn(
        "group bg-card relative flex flex-col rounded-3xl border p-6 transition-all duration-300",
        isSelected
          ? "border-teal-deep/60 ring-teal-deep/20 shadow-md ring-2"
          : "border-border/60 hover:border-teal/40 hover:shadow-md",
      )}
    >
      <header className="flex items-start gap-4">
        <div
          className={cn(
            "font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold transition-colors",
            isSelected ? "bg-teal-deep text-cream" : "bg-sand text-teal-deep",
          )}
          aria-hidden="true"
        >
          {initials(dentist.dentistName)}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-foreground truncate text-lg leading-tight font-bold">
            {dentist.dentistName}
          </h3>
          <p className="text-muted-foreground mt-0.5 truncate text-sm">{dentist.clinicName}</p>
          <p className="text-muted-foreground/80 mt-2 inline-flex items-center gap-1 text-xs">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {dentist.city} ✦ {dentist.experienceYears} שנות ניסיון
          </p>
        </div>

        <div className="shrink-0 text-end">
          <div className="text-foreground inline-flex items-center gap-1 text-sm font-semibold">
            <Star className="fill-coral text-coral h-3.5 w-3.5" />
            {dentist.rating.toFixed(1)}
          </div>
          <p className="text-muted-foreground mt-0.5 text-[10px]">{dentist.reviewCount} ביקורות</p>
        </div>
      </header>

      {/* Specialties */}
      <ul className="mt-5 flex flex-wrap gap-1.5">
        {dentist.specialties.slice(0, 3).map((s) => (
          <li
            key={s}
            className="bg-teal-deep/8 text-teal-deep rounded-full px-2.5 py-1 text-xs font-medium"
          >
            {translateSpecialty(s)}
          </li>
        ))}
      </ul>

      {/* HMOs */}
      <div className="text-muted-foreground mt-4 text-xs">
        <span className="font-medium">קופות חולים: </span>
        {dentist.hmoAffiliations.map(translateHmo).join(" ✦ ")}
      </div>

      {/* Action */}
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled && !isSelected}
        className={cn(
          "mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all",
          isSelected
            ? "bg-teal-deep text-cream hover:bg-teal-deep/90"
            : "border-border bg-background text-foreground hover:border-teal-deep/60 hover:bg-teal-deep/5 border",
          disabled && !isSelected && "cursor-not-allowed opacity-40 hover:bg-transparent",
        )}
        aria-pressed={isSelected}
      >
        {isSelected ? (
          <>
            <Check className="h-4 w-4" />
            נבחר
          </>
        ) : (
          "בחירת רופא"
        )}
      </button>
    </article>
  );
}
