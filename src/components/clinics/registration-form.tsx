"use client";

import { useRef, useState, useTransition } from "react";
import { Check, FileSignature, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { registerClinic } from "@/server/clinic-registration";
import { LOGO_ACCEPT_ATTRIBUTE, LOGO_MAX_FILE_SIZE_MB } from "@/lib/storage";
import { DOC_MAX_FILE_SIZE_MB, missingDocKinds, requiredDocKinds } from "@/lib/clinic-documents";
import {
  clinicDetailsSchema,
  clinicPlanSchema,
  fieldErrors,
  readRegistrationFields,
} from "@/lib/clinic-registration-schema";
import { SPECIALTIES, SPOKEN_LANGUAGES, TREATMENTS } from "@/lib/constants";
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
import { PlanPicker, type PlanChoice, type PlanOffer } from "@/components/clinics/plan-picker";
import { providerForCountry } from "@/lib/subscription";
import { DocumentDropZone, type UploadedDoc } from "@/components/clinics/document-drop-zone";
import { PendingReview } from "@/components/clinics/pending-review";

const inputClass =
  "border-border/60 bg-background focus:border-teal-deep focus:ring-teal-deep/20 w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2";

/** The subset of Country a clinic needs at registration time. */
export type RegistrationCountry = {
  code: string;
  /** In the reader's language. */
  name: string;
  insurers: string[];
  /** Which licence documents this country asks for. Empty means one generic. */
  requiredDocs: string[];
};

const STEP_COUNT = 3;

/** Where the wizard is, and which steps can be revisited by clicking them. */
function StepIndicator({
  step,
  labels,
  onJump,
}: {
  step: number;
  labels: string[];
  onJump: (i: number) => void;
}) {
  const t = useT();
  return (
    <nav aria-label={format(t.clinics.wizStepOf, { n: step + 1, total: STEP_COUNT })}>
      <p className="text-muted-foreground text-xs font-medium">
        {format(t.clinics.wizStepOf, { n: step + 1, total: STEP_COUNT })}
      </p>
      <ol className="mt-3 flex items-center gap-2">
        {labels.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                // Only backwards: forwards has to go through the step's checks.
                disabled={!done}
                onClick={() => onJump(i)}
                aria-current={current ? "step" : undefined}
                className="flex min-w-0 items-center gap-2 disabled:cursor-default"
              >
                <span
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors",
                    done && "border-teal-deep bg-teal-deep text-cream",
                    current && "border-teal-deep text-teal-deep",
                    !done && !current && "border-border text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-sm font-medium sm:inline",
                    current ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </button>
              {i < labels.length - 1 && (
                <span
                  aria-hidden
                  className={cn("h-0.5 flex-1 rounded-full", done ? "bg-teal-deep" : "bg-border")}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className="text-alert text-xs">
      {message}
    </span>
  );
}

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

export function RegistrationForm({
  countries,
  pricing,
  foundingLeft,
}: {
  countries: RegistrationCountry[];
  /** One offer per billing provider; the clinic's country picks which applies. */
  pricing: Record<"PAYPLUS" | "STRIPE", PlanOffer>;
  foundingLeft: number;
}) {
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
  // The price in the currency this clinic will actually be charged in.
  const offer = pricing[providerForCountry(countryCode)];
  const [step, setStep] = useState(0);
  // Keyed by field name, already translated. Cleared field by field as the
  // clinic types, so a fixed field stops shouting before the next "Continue".
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [planChoice, setPlanChoice] = useState<PlanChoice>("MONTHLY");
  const [agreed, setAgreed] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  // Keyed by kind rather than by index, so changing country cannot leave a URL
  // sitting under a slot that now means something else.
  const [docs, setDocs] = useState<Record<string, UploadedDoc>>({});
  const docKinds = requiredDocKinds(
    countries.find((c) => c.code === countryCode)?.requiredDocs ?? [],
  );
  const logoInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

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

  const goTo = (next: number) => {
    setStep(next);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /**
   * Checks the step on screen. Every step stays mounted (only hidden), so the
   * form still holds what earlier steps collected — the same FormData the
   * one-page form used to post.
   */
  const validateStep = (formData: FormData): boolean => {
    if (step === 1) {
      const missing = missingDocKinds(docKinds, Object.keys(docs));
      setErrors(missing.length > 0 ? { documents: t.clinics.wizDocsMissing } : {});
      return missing.length === 0;
    }
    const schema = step === 0 ? clinicDetailsSchema : clinicPlanSchema;
    const found = fieldErrors(schema.safeParse(readRegistrationFields(formData)));
    setErrors(
      Object.fromEntries(Object.entries(found).map(([field, key]) => [field, t.errors[key]])),
    );
    const first = Object.keys(found)[0];
    if (first) {
      toast.error(t.clinics.wizFixFields);
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    }
    return !first;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step === 0 && logoUploading) {
      toast.error(t.clinics.regLogoWait);
      return;
    }
    const formData = new FormData(e.currentTarget);
    if (!validateStep(formData)) return;
    // Enter in a field of an earlier step means "continue", not "register".
    if (step < STEP_COUNT - 1) {
      goTo(step + 1);
      return;
    }
    startTransition(async () => {
      const result = await registerClinic(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSubmittedEmail(
        String(formData.get("email") ?? "")
          .trim()
          .toLowerCase(),
      );
    });
  };

  const clearError = (e: React.FormEvent<HTMLFormElement>) => {
    const name = (e.target as HTMLInputElement).name;
    if (name && errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  if (submittedEmail !== null) {
    return (
      <PendingReview
        email={submittedEmail}
        trialDays={planChoice === "FREE" ? null : offer.trialDays}
      />
    );
  }

  const stepLabels = [t.clinics.regDetailsHeading, t.clinics.regDocs, t.clinics.regPlanHeading];

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onInput={clearError}
      // Validation is ours, per step. The browser's would try to focus a
      // required field on a hidden step and refuse to submit without saying why.
      noValidate
      className="scroll-mt-24 space-y-8"
    >
      <StepIndicator step={step} labels={stepLabels} onJump={goTo} />

      {/* Step 1 — details */}
      <div hidden={step !== 0} className="border-border/60 bg-card rounded-lg border p-6 sm:p-8">
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
                {f.required && <span className="text-alert"> *</span>}
                {f.hint && <span className="text-muted-foreground font-normal"> ({f.hint})</span>}
              </span>
              <input
                name={f.name}
                type={f.type ?? "text"}
                placeholder={f.placeholder}
                min={f.type === "number" ? 0 : undefined}
                aria-invalid={errors[f.name] ? true : undefined}
                aria-describedby={errors[f.name] ? `${f.name}-error` : undefined}
                className={cn(inputClass, errors[f.name] && "border-alert")}
              />
              <FieldError id={`${f.name}-error`} message={errors[f.name]} />
            </label>
          ))}

          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="text-foreground font-medium">
              {t.clinics.regCountry}
              <span className="text-alert"> *</span>
            </span>
            <select
              name="countryCode"
              value={countryCode}
              onChange={(e) => handleCountryChange(e.target.value)}
              aria-invalid={errors.countryCode ? true : undefined}
              aria-describedby={errors.countryCode ? "countryCode-error" : undefined}
              className={cn(inputClass, errors.countryCode && "border-alert")}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldError id="countryCode-error" message={errors.countryCode} />
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
                <span className="border-border/60 relative inline-block h-20 w-20 overflow-hidden rounded-lg border">
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
                  className="border-border/60 text-muted-foreground hover:border-teal-deep/40 hover:text-teal-deep inline-flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs transition-colors disabled:opacity-60"
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
        </div>
      </div>

      {/* Step 2 — licence documents */}
      <div hidden={step !== 1} className="border-border/60 bg-card rounded-lg border p-6 sm:p-8">
        <h2 className="font-display text-foreground text-lg font-bold">{t.clinics.regDocs}</h2>
        {/* Above the slots, not beside them: what is allowed has to be read
            before the file picker opens — afterwards it is a complaint. */}
        <p className="text-muted-foreground mt-2 text-sm">
          {format(t.clinics.regDocsHint, { mb: DOC_MAX_FILE_SIZE_MB })}
        </p>
        <div className="mt-5 space-y-3">
          {docKinds.map((kind) => (
            <div key={kind}>
              <input type="hidden" name="documentKind" value={kind} />
              <input type="hidden" name="documentUrl" value={docs[kind]?.url ?? ""} />
              <input type="hidden" name="documentType" value={docs[kind]?.contentType ?? ""} />
              <DocumentDropZone
                kind={kind}
                doc={docs[kind]}
                onUploaded={(doc) => {
                  setDocs((prev) => ({ ...prev, [kind]: doc }));
                  setErrors({});
                }}
                onRemove={() => removeDoc(kind)}
              />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <FieldError id="documents-error" message={errors.documents} />
        </div>
      </div>

      {/* Step 3 — plan + contract */}
      <div
        hidden={step !== 2}
        className="border-teal-deep/30 bg-teal-deep/5 rounded-lg border p-6 sm:p-8"
      >
        <div className="flex items-center gap-2.5">
          <FileSignature className="text-teal-deep h-5 w-5" />
          <h2 className="font-display text-foreground text-lg font-bold">
            {t.clinics.regPlanHeading}
          </h2>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">{t.clinics.regPlanIntro}</p>

        <div className="mt-5">
          {offer.founding && (
            <p className="bg-highlight/30 text-foreground mb-4 rounded-lg p-3 text-sm">
              {format(t.clinics.foundingBanner, { left: foundingLeft })}
            </p>
          )}
          <PlanPicker value={planChoice} onChange={setPlanChoice} offer={offer} />
          <FieldError id="plan-error" message={errors.plan} />
        </div>

        <ol className="text-foreground/90 mt-6 space-y-3 text-sm">
          {t.clinics.terms.map((clause: string, i: number) => (
            <li key={i} className="flex gap-2.5">
              <span className="bg-teal-deep/10 text-teal-deep mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {i + 1}
              </span>
              <span className="text-pretty">
                {format(clause, {
                  monthly: formatMoney(offer.monthlyMinor, offer.currency, locale),
                  yearly: formatMoney(offer.yearlyMinor, offer.currency, locale),
                  trialDays: offer.trialDays,
                  freeCap: offer.freeCap ?? 0,
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
            aria-invalid={errors.agreeToTerms ? true : undefined}
            aria-describedby={errors.agreeToTerms ? "agreeToTerms-error" : undefined}
            className="accent-teal-deep mt-0.5 h-4 w-4 shrink-0"
          />
          <span className="flex flex-col gap-1">
            <span className="text-foreground">{t.clinics.regAgree}</span>
            <FieldError id="agreeToTerms-error" message={errors.agreeToTerms} />
          </span>
        </label>
      </div>

      <div className="flex gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => {
              setErrors({});
              goTo(step - 1);
            }}
            disabled={isPending}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-12 rounded-lg px-7 text-base font-semibold",
            )}
          >
            {t.clinics.wizBack}
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            buttonVariants(),
            "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-12 flex-1 items-center justify-center rounded-lg px-7 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {step < STEP_COUNT - 1
            ? t.clinics.wizNext
            : isPending
              ? t.clinics.regSubmitting
              : t.clinics.regSubmit}
        </button>
      </div>
    </form>
  );
}
