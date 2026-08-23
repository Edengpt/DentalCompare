"use client";

import { Check, MapPin, Star } from "lucide-react";
import type { PublicDentist } from "@/lib/dentist-public";
import { cn } from "@/lib/utils";
import { translateInsurer, translateLanguage, translateSpecialty } from "@/lib/labels";
import { useT } from "@/i18n/provider";
import { format, plural } from "@/i18n/format";

type DentistCardProps = {
  dentist: PublicDentist;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

function initials(name: string) {
  const parts = name
    // Strips an honorific so the avatar initials read from the name itself.
    .replace(/^(ד"ר|Dr\.?)\s*/iu, "")
    .trim()
    .split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("");
}

export function DentistCard({ dentist, isSelected, onToggle, disabled }: DentistCardProps) {
  const t = useT();
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
        {dentist.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dentist.profileImageUrl}
            alt={dentist.clinicName}
            className="h-14 w-14 shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <div
            className={cn(
              "font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold transition-colors",
              isSelected ? "bg-teal-deep text-cream" : "bg-sand text-teal-deep",
            )}
            aria-hidden="true"
          >
            {initials(dentist.dentistName)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-foreground truncate text-lg leading-tight font-bold">
            {dentist.dentistName}
          </h3>
          <p className="text-muted-foreground mt-0.5 truncate text-sm">{dentist.clinicName}</p>
          <p className="text-muted-foreground/80 mt-2 inline-flex items-center gap-1 text-xs">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {dentist.city} ✦{" "}
            {format(t.dentists.yearsExperience, { count: dentist.experienceYears })}
          </p>
        </div>

        <div className="shrink-0 text-end">
          {dentist.reviewCount > 0 ? (
            <>
              <div className="text-foreground inline-flex items-center gap-1 text-sm font-semibold">
                <Star className="fill-coral text-coral h-3.5 w-3.5" />
                {dentist.rating.toFixed(1)}
              </div>
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                {plural(t.dentists.reviews, dentist.reviewCount)}
              </p>
            </>
          ) : (
            <span className="bg-teal-deep/8 text-teal-deep rounded-full px-2.5 py-1 text-[10px] font-semibold">
              {t.dentists.isNew}
            </span>
          )}
        </div>
      </header>

      {/* Specialties */}
      <ul className="mt-5 flex flex-wrap gap-1.5">
        {dentist.specialties.slice(0, 3).map((s) => (
          <li
            key={s}
            className="bg-teal-deep/8 text-teal-deep rounded-full px-2.5 py-1 text-xs font-medium"
          >
            {translateSpecialty(t.labels, s)}
          </li>
        ))}
      </ul>

      {/* HMOs */}
      <div className="text-muted-foreground mt-4 text-xs">
        <span className="font-medium">{t.dentists.insurersLabel}</span>
        {dentist.insurerAffiliations.map((i) => translateInsurer(t.labels, i)).join(" ✦ ")}
      </div>

      {/* Languages. Hidden when the clinic named none, rather than shown empty —
          a blank row reads as "speaks nothing" instead of "didn't say". */}
      {dentist.spokenLanguages.length > 0 && (
        <div className="text-muted-foreground mt-1.5 text-xs">
          <span className="font-medium">{t.dentists.languagesLabel}</span>
          {dentist.spokenLanguages.map((l) => translateLanguage(t.labels, l)).join(" ✦ ")}
        </div>
      )}

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
            {t.dentists.selected}
          </>
        ) : (
          t.dentists.selectAria
        )}
      </button>
    </article>
  );
}
