"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useLocale } from "@/i18n/provider";
import type { Specialty } from "@/lib/constants";
import {
  START_PREFERENCES_COOKIE,
  START_PREFERENCES_MAX_AGE,
  serializeStartPreferences,
} from "@/lib/start-preferences";

type StartSearchState = {
  /** "" means "not sure yet / any treatment". */
  specialty: Specialty | "";
  setSpecialty: (value: Specialty | "") => void;
  /** An ISO country code, or "" for "anywhere". */
  country: string;
  setCountry: (value: string) => void;
  /** Saves the answers as defaults and starts the request. */
  start: (override?: { country?: string }) => void;
};

const Context = createContext<StartSearchState | null>(null);

/**
 * One set of answers shared by the search box, the treatment chips and the
 * destination tiles, so a chip fills the box and a tile starts the request with
 * whatever treatment is already picked.
 *
 * Nothing here searches: prices only exist once clinics have seen the plan.
 * The answers travel as defaults in a cookie (src/lib/start-preferences.ts).
 */
export function StartSearchProvider({
  defaultCountry,
  children,
}: {
  defaultCountry: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const locale = useLocale();
  // Auth-aware: a signed-in visitor must NOT be sent to /sign-up (Clerk bounces
  // them back and the button looks broken).
  const { isSignedIn } = useAuth();
  const [specialty, setSpecialty] = useState<Specialty | "">("");
  const [country, setCountry] = useState(defaultCountry);

  const start = (override?: { country?: string }) => {
    const chosenCountry = override?.country ?? country;
    document.cookie = `${START_PREFERENCES_COOKIE}=${encodeURIComponent(
      serializeStartPreferences({
        specialty: specialty || null,
        country: chosenCountry || null,
      }),
    )}; Path=/; Max-Age=${START_PREFERENCES_MAX_AGE}; SameSite=Lax`;
    router.push(`/${locale}${isSignedIn ? "/request/new" : "/sign-up"}`);
  };

  return (
    <Context.Provider value={{ specialty, setSpecialty, country, setCountry, start }}>
      {children}
    </Context.Provider>
  );
}

export function useStartSearch(): StartSearchState {
  const value = useContext(Context);
  if (!value) throw new Error("useStartSearch must be used inside <StartSearchProvider>");
  return value;
}
