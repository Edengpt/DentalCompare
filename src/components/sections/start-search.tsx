"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@/i18n/provider";
import type { Specialty } from "@/lib/constants";
import {
  START_PREFERENCES_COOKIE,
  START_PREFERENCES_MAX_AGE,
  serializeStartPreferences,
  type StartScope,
} from "@/lib/start-preferences";

type Labels = {
  treatmentLabel: string;
  treatmentAny: string;
  whereLabel: string;
  whereLocal: string;
  whereAny: string;
  submit: string;
};

/**
 * The yellow search frame from the design system.
 *
 * It does not search: prices only exist once clinics have seen the plan. It
 * starts the request with the two answers the flow would otherwise ask for
 * later, saved as defaults (see src/lib/start-preferences.ts), then goes where
 * the old hero button went.
 */
export function StartSearch({
  href,
  labels,
  specialties,
}: {
  /** Unprefixed app path, e.g. "/sign-up". */
  href: string;
  labels: Labels;
  specialties: { value: Specialty; label: string }[];
}) {
  const router = useRouter();
  const locale = useLocale();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const specialty = (form.get("specialty") as Specialty | "") || null;
    const scope = (form.get("scope") as StartScope | "") || null;
    document.cookie = `${START_PREFERENCES_COOKIE}=${encodeURIComponent(
      serializeStartPreferences({ specialty, scope }),
    )}; Path=/; Max-Age=${START_PREFERENCES_MAX_AGE}; SameSite=Lax`;
    router.push(`/${locale}${href}`);
  };

  const field =
    "bg-background flex min-h-16 flex-1 basis-56 flex-col justify-center gap-0.5 rounded-sm px-4 py-2 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-teal";
  const select =
    "text-foreground w-full cursor-pointer border-0 bg-transparent p-0 text-base font-semibold outline-none";

  return (
    <form
      onSubmit={onSubmit}
      className="bg-highlight shadow-card flex flex-wrap gap-1 rounded-lg p-1 text-start"
    >
      <label className={field}>
        <span className="text-muted-foreground text-xs">{labels.treatmentLabel}</span>
        <select name="specialty" defaultValue="" className={select}>
          <option value="">{labels.treatmentAny}</option>
          {specialties.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        <span className="text-muted-foreground text-xs">{labels.whereLabel}</span>
        <select name="scope" defaultValue="LOCAL" className={select}>
          <option value="LOCAL">{labels.whereLocal}</option>
          <option value="ANY">{labels.whereAny}</option>
        </select>
      </label>
      <button
        type="submit"
        className="bg-coral hover:bg-teal-deep focus-visible:outline-teal-deep min-h-16 flex-auto rounded-sm px-8 text-lg font-bold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:flex-none"
      >
        {labels.submit}
      </button>
    </form>
  );
}
