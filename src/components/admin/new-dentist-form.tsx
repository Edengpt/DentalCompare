"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createDentist } from "@/server/admin-actions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const inputClass =
  "border-border/60 bg-background focus:border-teal-deep focus:ring-teal-deep/20 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2";

const fields = [
  { name: "dentistName", label: "שם הרופא", required: true, placeholder: 'ד"ר ישראל ישראלי' },
  { name: "clinicName", label: "שם המרפאה", required: true, placeholder: "מרפאת חיוך" },
  { name: "email", label: "אימייל", required: true, type: "email", placeholder: "dr@clinic.co.il" },
  { name: "phone", label: "טלפון", required: true, placeholder: "03-1234567" },
  { name: "city", label: "עיר", required: true, placeholder: "תל אביב" },
  { name: "address", label: "כתובת", required: true, placeholder: "הרצל 1, תל אביב" },
  {
    name: "experienceYears",
    label: "שנות ניסיון",
    required: true,
    type: "number",
    placeholder: "10",
  },
  {
    name: "specialties",
    label: "התמחויות (מופרד בפסיקים)",
    placeholder: "Implantology, Aesthetics",
  },
  { name: "treatments", label: "טיפולים (מופרד בפסיקים)", placeholder: "Implants, Crowns" },
  { name: "hmoAffiliations", label: "קופות חולים (מופרד בפסיקים)", placeholder: "Clalit, Maccabi" },
];

export function NewDentistForm() {
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
      toast.success("הרופא נוסף בהצלחה");
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
        רופא חדש
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
          {isPending ? "שומר…" : "שמירה"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground text-sm font-medium"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
