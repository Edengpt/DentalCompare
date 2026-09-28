"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { locales, localeNames } from "@/i18n/config";
import { format } from "@/i18n/format";
import { createCountry } from "@/server/country-actions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const inputClass =
  "border-border/60 bg-background focus:border-teal-deep focus:ring-teal-deep/20 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2";

export function NewCountryForm() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const fields = [
    { name: "code", label: t.admin.fieldCode, required: true, placeholder: "HU" },
    { name: "nameEn", label: t.admin.fieldNameEn, required: true, placeholder: "Hungary" },
    { name: "currency", label: t.admin.fieldCurrency, required: true, placeholder: "HUF" },
    { name: "callingCode", label: t.admin.fieldCallingCode, required: true, placeholder: "36" },
    { name: "insurers", label: t.admin.fieldInsurers, placeholder: "OEP, Generali" },
    { name: "requiredDocs", label: t.admin.fieldRequiredDocs, placeholder: "Licence, Insurance" },
  ];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("nameEn") ?? "");
    startTransition(async () => {
      const result = await createCountry(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(format(t.admin.countryCreated, { country: name }));
      formRef.current?.reset();
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          buttonVariants(),
          "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold",
        )}
      >
        <Plus className="h-4 w-4" />
        {t.admin.newCountry}
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="border-border/60 bg-card grid w-full gap-4 rounded-2xl border p-5 sm:grid-cols-2"
    >
      <p className="text-muted-foreground text-sm sm:col-span-2">{t.admin.countryDraftNotice}</p>

      {fields.map((f) => (
        <label key={f.name} className="flex flex-col gap-1.5 text-sm">
          <span className="text-foreground font-medium">
            {f.label}
            {f.required && <span className="text-alert"> *</span>}
          </span>
          <input
            name={f.name}
            required={f.required}
            placeholder={f.placeholder}
            className={inputClass}
          />
        </label>
      ))}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-foreground font-medium">
          {t.admin.fieldDefaultLocale}
          <span className="text-alert"> *</span>
        </span>
        <select name="defaultLocale" defaultValue="en" className={inputClass}>
          {locales.map((l) => (
            <option key={l} value={l}>
              {localeNames[l]}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            buttonVariants(),
            "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold disabled:opacity-60",
          )}
        >
          {isPending ? t.selection.saving : t.admin.newCountry}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground text-sm font-medium"
        >
          {t.admin.reject}
        </button>
      </div>
    </form>
  );
}
