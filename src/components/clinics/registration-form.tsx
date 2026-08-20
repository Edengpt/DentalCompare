"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, FileSignature, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { registerClinic } from "@/server/clinic-registration";
import { LOGO_ACCEPT_ATTRIBUTE, LOGO_MAX_FILE_SIZE_MB } from "@/lib/storage";
import { SUBSCRIPTION_TERMS_HE, SPECIALTIES, TREATMENTS } from "@/lib/constants";
import { SPECIALTY_LABELS_HE, translateInsurer, translateTreatment } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PlanPicker } from "@/components/clinics/plan-picker";

const inputClass =
  "border-border/60 bg-background focus:border-teal-deep focus:ring-teal-deep/20 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2";

const fields: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  hint?: string;
}[] = [
  { name: "contactName", label: "איש קשר", required: true, placeholder: "השם שלך" },
  { name: "dentistName", label: "שם הרופא", required: true, placeholder: 'ד"ר ישראל ישראלי' },
  { name: "clinicName", label: "שם המרפאה", required: true, placeholder: "מרפאת חיוך" },
  { name: "email", label: "אימייל", required: true, type: "email", placeholder: "dr@clinic.co.il" },
  { name: "phone", label: "טלפון", required: true, type: "tel", placeholder: "03-1234567" },
  { name: "city", label: "עיר", required: true, placeholder: "תל אביב" },
  { name: "address", label: "כתובת המרפאה", required: true, placeholder: "הרצל 1, תל אביב" },
  {
    name: "experienceYears",
    label: "שנות ניסיון",
    required: true,
    type: "number",
    placeholder: "10",
  },
];

// Multi-select chip groups — clinics pick from the canonical lists so stored
// values are always valid (no free-typed strings the app can't translate).
const chipGroups: { name: string; label: string; options: { value: string; label: string }[] }[] = [
  {
    name: "specialties",
    label: "התמחויות",
    options: SPECIALTIES.map((s) => ({ value: s, label: SPECIALTY_LABELS_HE[s] })),
  },
  {
    name: "treatments",
    label: "טיפולים",
    options: TREATMENTS.map((t) => ({ value: t, label: translateTreatment(t) })),
  },
];

/** The subset of Country a clinic needs at registration time. */
export type RegistrationCountry = {
  code: string;
  nameEn: string;
  insurers: string[];
};

function ChipGroup({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-foreground text-sm font-medium">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input type="checkbox" name={name} value={o.value} className="peer sr-only" />
            <span className="border-border/60 text-foreground peer-checked:border-teal-deep peer-checked:bg-teal-deep peer-checked:text-cream peer-focus-visible:ring-teal-deep/30 inline-block rounded-full border px-3.5 py-1.5 text-sm transition-colors peer-focus-visible:ring-2">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function RegistrationForm({ countries }: { countries: RegistrationCountry[] }) {
  const [isPending, startTransition] = useTransition();
  // Where the clinic operates. Drives its currency, its payer list and which
  // licence documents an admin will ask for — so it can't be inferred.
  const [countryCode, setCountryCode] = useState(countries[0]?.code ?? "");
  const insurers = countries.find((c) => c.code === countryCode)?.insurers ?? [];
  const [done, setDone] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/clinics/logo", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "העלאת הלוגו נכשלה");
        return;
      }
      setLogoUrl(data.url);
    } catch {
      toast.error("העלאת הלוגו נכשלה — נסו שוב");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (logoUploading) {
      toast.error("המתינו לסיום העלאת הלוגו");
      return;
    }
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await registerClinic(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDone(true);
    });
  };

  if (done) {
    return (
      <div className="border-border/60 bg-card mx-auto max-w-xl rounded-3xl border p-10 text-center">
        <div className="bg-teal-deep/10 text-teal-deep mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="font-display text-foreground mt-6 text-2xl font-bold">ההרשמה התקבלה!</h2>
        <p className="text-muted-foreground mt-3 text-pretty">
          תודה שהצטרפתם ל-DentalCompare. הבקשה שלכם ממתינה לאישור הצוות — לאחר האישור המרפאה תופיע
          במאגר ותתחילו לקבל בקשות להצעות מחיר. נעדכן אתכם במייל.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Details */}
      <div className="border-border/60 bg-card rounded-3xl border p-6 sm:p-8">
        <h2 className="font-display text-foreground text-lg font-bold">פרטי המרפאה</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <label
              key={f.name}
              className={cn(
                "flex flex-col gap-1.5 text-sm",
                f.name === "address" && "sm:col-span-2",
              )}
            >
              <span className="text-foreground font-medium">
                {f.label}
                {f.required && <span className="text-coral"> *</span>}
                {f.hint && <span className="text-muted-foreground font-normal"> ({f.hint})</span>}
              </span>
              <input
                name={f.name}
                type={f.type ?? "text"}
                required={f.required}
                placeholder={f.placeholder}
                min={f.type === "number" ? 0 : undefined}
                className={inputClass}
              />
            </label>
          ))}

          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="text-foreground font-medium">
              מדינה<span className="text-coral"> *</span>
            </span>
            <select
              name="countryCode"
              required
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className={inputClass}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.nameEn}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 space-y-6">
          {chipGroups.map((g) => (
            <ChipGroup key={g.name} name={g.name} label={g.label} options={g.options} />
          ))}

          {/* Insurers, from the selected country. Hidden entirely where that
              country has no payer system — an empty picker is worse than none. */}
          {insurers.length > 0 && (
            <ChipGroup
              name="insurerAffiliations"
              label="מבטחים"
              options={insurers.map((i) => ({ value: i, label: translateInsurer(i) }))}
            />
          )}

          {/* Logo (optional) */}
          <div>
            <p className="text-foreground text-sm font-medium">
              לוגו / תמונת מרפאה
              <span className="text-muted-foreground font-normal"> (אופציונלי)</span>
            </p>
            <input type="hidden" name="profileImageUrl" value={logoUrl ?? ""} />
            <div className="mt-2 flex items-center gap-4">
              {logoUrl ? (
                <span className="border-border/60 relative inline-block h-20 w-20 overflow-hidden rounded-2xl border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="תצוגת לוגו" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    aria-label="הסרת הלוגו"
                    className="bg-foreground/70 text-cream absolute end-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="border-border/60 text-muted-foreground hover:border-teal-deep/40 hover:text-teal-deep inline-flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed text-xs transition-colors disabled:opacity-60"
                >
                  {logoUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="h-5 w-5" />
                      העלאה
                    </>
                  )}
                </button>
              )}
              <p className="text-muted-foreground text-xs">
                JPG, PNG או WEBP ✦ עד {LOGO_MAX_FILE_SIZE_MB}MB
              </p>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept={LOGO_ACCEPT_ATTRIBUTE}
              onChange={handleLogoChange}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Plan + contract */}
      <div className="border-teal-deep/30 bg-teal-deep/5 rounded-3xl border p-6 sm:p-8">
        <div className="flex items-center gap-2.5">
          <FileSignature className="text-teal-deep h-5 w-5" />
          <h2 className="font-display text-foreground text-lg font-bold">מסלול ותנאי מנוי</h2>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          בחרו מסלול. החיוב יתבצע רק לאחר אישור המרפאה על ידי הצוות — נשלח אליכם קישור להשלמת התשלום.
        </p>

        <div className="mt-5">
          <PlanPicker />
        </div>

        <ol className="text-foreground/90 mt-6 space-y-3 text-sm">
          {SUBSCRIPTION_TERMS_HE.map((clause, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="bg-teal-deep/10 text-teal-deep mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {i + 1}
              </span>
              <span className="text-pretty">{clause}</span>
            </li>
          ))}
        </ol>

        <label className="border-border/60 mt-6 flex cursor-pointer items-start gap-3 border-t pt-5 text-sm">
          <input
            type="checkbox"
            name="agreeToTerms"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="accent-teal-deep mt-0.5 h-4 w-4 shrink-0"
          />
          <span className="text-foreground">
            קראתי, הבנתי ואני מאשר/ת בשם המרפאה את תנאי המנוי המפורטים לעיל.
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending || !agreed}
        className={cn(
          buttonVariants(),
          "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-12 w-full items-center justify-center rounded-full px-7 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {isPending ? "שולח…" : "הרשמת המרפאה"}
      </button>
    </form>
  );
}
