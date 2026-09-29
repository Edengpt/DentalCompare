"use client";

import { Check, MapPin, ShieldCheck } from "lucide-react";
import type { PublicDentist } from "@/lib/dentist-public";
import { cn } from "@/lib/utils";
import { translateInsurer, translateLanguage, translateSpecialty } from "@/lib/labels";
import { useT } from "@/i18n/provider";
import { format, plural } from "@/i18n/format";

type DentistCardProps = {
  dentist: PublicDentist;
  /** Already resolved for display — the card never sees a raw ISO code. */
  countryName: string;
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

export function DentistCard({
  dentist,
  countryName,
  isSelected,
  onToggle,
  disabled,
}: DentistCardProps) {
  const t = useT();
  return (
    <article
      className={cn(
        "group bg-card relative flex flex-col rounded-lg border p-6 transition-all duration-300",
        // Selected reads like the design system's highlighted result card:
        // blue-50 fill with a blue-600 border, not a ring.
        isSelected
          ? "border-teal bg-coral-soft shadow-card"
          : "border-border hover:border-teal/40 hover:shadow-card",
      )}
    >
      <header className="flex items-start gap-4">
        {dentist.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dentist.profileImageUrl}
            alt={dentist.clinicName}
            className="h-14 w-14 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div
            className={cn(
              "font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-lg font-bold transition-colors",
              isSelected ? "bg-teal-deep text-cream" : "bg-sand text-teal-deep",
            )}
            aria-hidden="true"
          >
            {initials(dentist.clinicName)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {/* The clinic is what the patient is choosing and what the rest of
              the site talks about; the dentist is who they will meet there. */}
          <h3 className="font-display text-foreground truncate text-lg leading-tight font-bold">
            {dentist.clinicName}
          </h3>
          <p className="text-muted-foreground mt-0.5 truncate text-sm">{dentist.dentistName}</p>
          {/* Rendered from the row, never as a constant. Every listed clinic is
              verified by construction — which is exactly why: if that gate ever
              breaks, a constant badge would keep claiming "verified" about a
              clinic nobody checked, while this one simply disappears. */}
          {dentist.licenceVerifiedAt && (
            <span className="bg-teal-deep/10 text-teal-deep mt-1.5 inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-medium">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              {t.dentists.verifiedBadge}
            </span>
          )}
          <p className="text-muted-foreground/80 mt-2 inline-flex items-center gap-1 text-xs">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {/* Country before city: "Tel Aviv" beside "Budapest" with no country
                is a list the reader has to decode. */}
            {countryName} ✦ {dentist.city} ✦{" "}
            {format(t.dentists.yearsExperience, { count: dentist.experienceYears })}
          </p>
        </div>

        <div className="shrink-0 text-end">
          {dentist.reviewCount > 0 ? (
            <>
              {/* Score badge: the rating in a navy square, one decimal place. */}
              <span className="bg-teal-deep text-cream inline-flex h-8 min-w-8 items-center justify-center rounded-sm px-1 text-base font-bold tabular-nums">
                {dentist.rating.toFixed(1)}
              </span>
              <p className="text-muted-foreground mt-1 text-xs">
                {plural(t.dentists.reviews, dentist.reviewCount)}
              </p>
            </>
          ) : (
            <span className="bg-highlight text-on-highlight rounded-sm px-2 py-0.5 text-xs font-semibold">
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
            className="bg-teal-deep/8 text-teal-deep rounded-sm px-2.5 py-1 text-xs font-medium"
          >
            {translateSpecialty(t.labels, s)}
          </li>
        ))}
      </ul>

      {/* Insurers. Hidden when there are none, like languages below: most
          countries have no payer list at all, and an empty label reads as a
          missing answer. */}
      {dentist.insurerAffiliations.length > 0 && (
        <div className="text-muted-foreground mt-4 text-xs">
          <span className="font-medium">{t.dentists.insurersLabel}</span>
          {dentist.insurerAffiliations.map((i) => translateInsurer(t.labels, i)).join(" ✦ ")}
        </div>
      )}

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
          "mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all",
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
