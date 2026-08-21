"use client";

import { useT } from "@/i18n/provider";
import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createDentist } from "@/server/admin-actions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const inputClass =
  "border-border/60 bg-background focus:border-teal-deep focus:ring-teal-deep/20 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2";

export function NewDentistForm() {
  const t = useT();

  const fields = [
    { name: "dentistName", label: t.clinics.regDentistName, required: true, placeholder: "Dr Jane Smith" },
    { name: "clinicName", label: t.clinics.regClinicName, required: true, placeholder: "Smile Dental" },
    { name: "email", label: t.clinics.regEmail, required: true, type: "email", placeholder: "dr@clinic.com" },
    { name: "phone", label: t.clinics.regPhone, required: true, placeholder: "+44 20 1234 5678" },
    { name: "city", label: t.clinics.regCity, required: true, placeholder: "Budapest" },
    { name: "address", label: t.admin.address, required: true, placeholder: "1 Main Street, Budapest" },
    {
      name: "experienceYears",
      label: t.clinics.regExperience,
      required: true,
      type: "number",
      placeholder: "10",
    },
    {
      name: "specialties",
      label: t.admin.colSpecialties,
      placeholder: "Implantology, Aesthetics",
    },
    { name: "treatments", label: t.admin.treatments, placeholder: "Implants, Crowns" },
    { name: "insurerAffiliations", label: t.admin.colInsurers, placeholder: "Clalit, Maccabi" },
  ];

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createDentist(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t.admin.newRegistration);
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
        {t.admin.newRegistration}
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="border-border/60 bg-card grid gap-4 rounded-2xl border p-5 sm:grid-cols-2"
    >
      {fields.map((f) => (
        <label key={f.name} className="flex flex-col gap-1.5 text-sm">
          <span className="text-foreground font-medium">
            {f.label}
            {f.required && <span className="text-coral"> *</span>}
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

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            buttonVariants(),
            "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold disabled:opacity-60",
          )}
        >
          {isPending ? t.selection.saving : t.admin.approve}
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
