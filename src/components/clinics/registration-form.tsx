"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, FileSignature, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { registerClinic } from "@/server/clinic-registration";
import { LOGO_ACCEPT_ATTRIBUTE, LOGO_MAX_FILE_SIZE_MB } from "@/lib/storage";
import {
  DOC_ACCEPT_ATTRIBUTE,
  DOC_MAX_FILE_SIZE_MB,
  requiredDocKinds,
} from "@/lib/clinic-documents";
import {
  SPECIALTIES,
  SPOKEN_LANGUAGES,
  TREATMENTS,
  SUBSCRIPTION_PLANS,
  TRIAL_DAYS,
} from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { useLocale } from "@/i18n/provider";
import {
  translateInsurer,
  translateLanguage,
  translateSpecialty,
  translateTreatment,
} from "@/lib/labels";
import { useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PlanPicker } from "@/components/clinics/plan-picker";

const inputClass =
  "border-border/60 bg-background focus:border-teal-deep focus:ring-teal-deep/20 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2";

/** The subset of Country a clinic needs at registration time. */
export type RegistrationCountry = {
  code: string;
  nameEn: string;
  insurers: string[];
  /** Which licence documents this country asks for. Empty means one generic. */
  requiredDocs: string[];
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
  const t = useT();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  // Defined inside the component: every label comes from context now.
  const fields: {
    name: string;
    label: string;
    required?: boolean;
    type?: string;
    placeholder?: string;
    hint?: string;
  }[] = [
    {
      name: "contactName",
      label: t.clinics.regContactName,
      required: true,
      placeholder: t.clinics.regContactNamePlaceholder,
    },
    {
      name: "dentistName",
      label: t.clinics.regDentistName,
      required: true,
      placeholder: t.clinics.regDentistNamePlaceholder,
    },
    {
      name: "clinicName",
      label: t.clinics.regClinicName,
      required: true,
      placeholder: t.clinics.regClinicNamePlaceholder,
    },
    {
      name: "email",
      label: t.clinics.regEmail,
      required: true,
      type: "email",
      placeholder: t.clinics.regEmailPlaceholder,
    },
    {
      name: "phone",
      label: t.clinics.regPhone,
      required: true,
      type: "tel",
      placeholder: t.clinics.regPhonePlaceholder,
    },
    {
      name: "city",
      label: t.clinics.regCity,
      required: true,
      placeholder: t.clinics.regCityPlaceholder,
    },
    {
      name: "address",
      label: t.clinics.regAddress,
      required: true,
      placeholder: t.clinics.regAddressPlaceholder,
    },
    {
      name: "experienceYears",
      label: t.clinics.regExperience,
      required: true,
      type: "number",
      placeholder: "10",
    },
  ];

  // Multi-select chip groups — clinics pick from the canonical lists so stored
  // values are always valid (no free-typed strings the app can't translate).
  const chipGroups: { name: string; label: string; options: { value: string; label: string }[] }[] =
    [
      {
        name: "specialties",
        label: t.clinics.regSpecialties,
        options: SPECIALTIES.map((v) => ({ value: v, label: translateSpecialty(t.labels, v) })),
      },
      {
        name: "treatments",
        label: t.clinics.regTreatments,
        options: TREATMENTS.map((v) => ({ value: v, label: translateTreatment(t.labels, v) })),
      },
      // Comparison data rather than a profile nicety: across borders a patient
      // who cannot be understood will not travel, however good the price.
      {
        name: "spokenLanguages",
        label: t.clinics.regLanguages,
        options: SPOKEN_LANGUAGES.map((v) => ({ value: v, label: translateLanguage(t.labels, v) })),
      },
    ];

  // Where the clinic operates. Drives its currency, its payer list and which
  // licence documents an admin will ask for — so it can't be inferred.
  const [countryCode, setCountryCode] = useState(countries[0]?.code ?? "");
  const insurers = countries.find((c) => c.code === countryCode)?.insurers ?? [];
  const [done, setDone] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  // Keyed by kind rather than by index, so changing country cannot leave a URL
  // sitting under a slot that now means something else.
  const [docs, setDocs] = useState<Record<string, { url: string; contentType: string }>>({});
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const docKinds = requiredDocKinds(
    countries.find((c) => c.code === countryCode)?.requiredDocs ?? [],
  );
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Checked here as well as on the server, because a file over the platform's
    // request limit never reaches the server at all — the edge rejects it and
    // the clinic is left with an error that retrying cannot fix.
    if (file.size > LOGO_MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(format(t.validation.logoSize, { mb: LOGO_MAX_FILE_SIZE_MB }));
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }

    setLogoUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/clinics/logo", { method: "POST", body });

      // Not every failure is ours to phrase. A rejection at the edge comes back
      // as plain text, and parsing it as JSON throws — which used to surface as
      // "please try again", advice that could never work.
      const data = (await res.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;

      if (!res.ok || !data?.url) {
        toast.error(
          data?.error ??
            (res.status === 413
              ? format(t.validation.logoSize, { mb: LOGO_MAX_FILE_SIZE_MB })
              : t.clinics.regLogoFailed),
        );
        return;
      }
      setLogoUrl(data.url);
    } catch {
      toast.error(t.clinics.regLogoRetry);
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleDocChange = async (kind: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Checked here as well as on the server: a file over the platform's request
    // limit never reaches the server at all — the edge rejects it, and the
    // clinic is left with an error that retrying cannot fix.
    if (file.size > DOC_MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(format(t.validation.documentSize, { mb: DOC_MAX_FILE_SIZE_MB }));
      e.target.value = "";
      return;
    }

    setUploadingKind(kind);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/clinics/documents", { method: "POST", body });
      // A rejection at the edge comes back as plain text, and parsing it as
      // JSON throws — which would surface as advice that can never work.
      const data = (await res.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.url) {
        toast.error(
          data?.error ??
            (res.status === 413
              ? format(t.validation.documentSize, { mb: DOC_MAX_FILE_SIZE_MB })
              : t.clinics.regDocFailed),
        );
        return;
      }
      setDocs((prev) => ({ ...prev, [kind]: { url: data.url as string, contentType: file.type } }));
    } catch {
      toast.error(t.clinics.regDocFailed);
    } finally {
      setUploadingKind(null);
      e.target.value = "";
    }
  };

  /**
   * Drops a document that is no longer attached to any slot.
   *
   * Best-effort on purpose: the endpoint refuses anything already attached to a
   * clinic, so the worst case here is an orphan rather than a deletion that
   * should not have happened.
   */
  const discardDoc = (url: string) => {
    void fetch("/api/clinics/documents", {
      method: "DELETE",
      body: JSON.stringify({ url }),
    }).catch(() => {});
  };

  const handleCountryChange = (code: string) => {
    // The new country asks for different documents, so what was uploaded no
    // longer belongs to any slot. Keeping the files "just in case" is exactly
    // how a private store fills with documents nobody can attribute to anyone.
    for (const doc of Object.values(docs)) discardDoc(doc.url);
    setDocs({});
    setCountryCode(code);
  };

  const removeDoc = (kind: string) => {
    const doc = docs[kind];
    if (doc) discardDoc(doc.url);
    setDocs((prev) => {
      const next = { ...prev };
      delete next[kind];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (logoUploading) {
      toast.error(t.clinics.regLogoWait);
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
        <h2 className="font-display text-foreground mt-6 text-2xl font-bold">
          {t.clinics.regDoneTitle}
        </h2>
        <p className="text-muted-foreground mt-3 text-pretty">{t.clinics.regDoneBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Details */}
      <div className="border-border/60 bg-card rounded-3xl border p-6 sm:p-8">
        <h2 className="font-display text-foreground text-lg font-bold">
          {t.clinics.regDetailsHeading}
        </h2>
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
              {t.clinics.regCountry}
              <span className="text-coral"> *</span>
            </span>
            <select
              name="countryCode"
              required
              value={countryCode}
              onChange={(e) => handleCountryChange(e.target.value)}
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
              label={t.clinics.regInsurers}
              options={insurers.map((i: string) => ({
                value: i,
                label: translateInsurer(t.labels, i),
              }))}
            />
          )}

          {/* Logo (optional) */}
          <div>
            <p className="text-foreground text-sm font-medium">
              {t.clinics.regLogo}
              <span className="text-muted-foreground font-normal">{t.clinics.regOptional}</span>
            </p>
            {/* Above the button, not beside it. What is allowed has to be read
                before the file picker opens — afterwards it is a complaint, not
                a hint. */}
            <p className="text-muted-foreground mt-1 text-xs">
              {format(t.clinics.regLogoHint, { mb: LOGO_MAX_FILE_SIZE_MB })}
            </p>
            <input type="hidden" name="profileImageUrl" value={logoUrl ?? ""} />
            <div className="mt-2 flex items-center gap-4">
              {logoUrl ? (
                <span className="border-border/60 relative inline-block h-20 w-20 overflow-hidden rounded-2xl border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt={t.clinics.regLogoAlt}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    aria-label={t.clinics.regLogoRemove}
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
                      {t.clinics.regLogoUpload}
                    </>
                  )}
                </button>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept={LOGO_ACCEPT_ATTRIBUTE}
              onChange={handleLogoChange}
              className="hidden"
            />
          </div>

          {/* Licence documents (required) */}
          <div className="sm:col-span-2">
            <p className="text-foreground text-sm font-medium">{t.clinics.regDocs}</p>
            {/* Above the slots, not beside them: what is allowed has to be read
                before the file picker opens — afterwards it is a complaint. */}
            <p className="text-muted-foreground mt-1 text-xs">
              {format(t.clinics.regDocsHint, { mb: DOC_MAX_FILE_SIZE_MB })}
            </p>
            <div className="mt-3 space-y-2">
              {docKinds.map((kind) => (
                <div
                  key={kind}
                  className="border-border/60 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5"
                >
                  <span className="text-foreground min-w-0 truncate text-sm">{kind}</span>
                  <input type="hidden" name="documentKind" value={kind} />
                  <input type="hidden" name="documentUrl" value={docs[kind]?.url ?? ""} />
                  <input type="hidden" name="documentType" value={docs[kind]?.contentType ?? ""} />
                  {docs[kind] ? (
                    <span className="text-teal-deep inline-flex shrink-0 items-center gap-1.5 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      {t.clinics.regDocUploaded}
                      <button
                        type="button"
                        onClick={() => removeDoc(kind)}
                        aria-label={t.clinics.regDocRemove}
                        className="text-muted-foreground hover:text-coral ms-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ) : (
                    <label
                      className={cn(
                        "border-border/60 text-muted-foreground hover:border-teal-deep/40 hover:text-teal-deep inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-dashed px-3.5 py-1.5 text-xs transition-colors",
                        uploadingKind === kind && "pointer-events-none opacity-60",
                      )}
                    >
                      {uploadingKind === kind ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ImagePlus className="h-3.5 w-3.5" />
                      )}
                      {t.clinics.regDocUpload}
                      <input
                        type="file"
                        accept={DOC_ACCEPT_ATTRIBUTE}
                        onChange={(e) => handleDocChange(kind, e)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Plan + contract */}
      <div className="border-teal-deep/30 bg-teal-deep/5 rounded-3xl border p-6 sm:p-8">
        <div className="flex items-center gap-2.5">
          <FileSignature className="text-teal-deep h-5 w-5" />
          <h2 className="font-display text-foreground text-lg font-bold">
            {t.clinics.regPlanHeading}
          </h2>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">{t.clinics.regPlanIntro}</p>

        <div className="mt-5">
          <PlanPicker />
        </div>

        <ol className="text-foreground/90 mt-6 space-y-3 text-sm">
          {t.clinics.terms.map((clause: string, i: number) => (
            <li key={i} className="flex gap-2.5">
              <span className="bg-teal-deep/10 text-teal-deep mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {i + 1}
              </span>
              <span className="text-pretty">
                {format(clause, {
                  monthly: formatMoney(
                    SUBSCRIPTION_PLANS.MONTHLY.priceMinor,
                    SUBSCRIPTION_PLANS.MONTHLY.currency,
                    locale,
                  ),
                  yearly: formatMoney(
                    SUBSCRIPTION_PLANS.YEARLY.priceMinor,
                    SUBSCRIPTION_PLANS.YEARLY.currency,
                    locale,
                  ),
                  trialDays: TRIAL_DAYS,
                })}
              </span>
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
          <span className="text-foreground">{t.clinics.regAgree}</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending || !agreed || docKinds.some((k) => !docs[k])}
        className={cn(
          buttonVariants(),
          "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-12 w-full items-center justify-center rounded-full px-7 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {isPending ? t.clinics.regSubmitting : t.clinics.regSubmit}
      </button>
    </form>
  );
}
