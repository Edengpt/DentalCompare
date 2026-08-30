"use client";

import { useT } from "@/i18n/provider";
import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { format } from "@/i18n/format";
import { DOC_ACCEPT_ATTRIBUTE, DOC_MAX_FILE_SIZE_MB } from "@/lib/clinic-documents";
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

  // A clinic added by hand goes through the same gate as one that registers
  // itself. This is the path used for a clinic recruited by phone, so skipping
  // it would break the promise on the busiest path first.
  const [doc, setDoc] = useState<{ url: string; contentType: string } | null>(null);
  const [docUploading, setDocUploading] = useState(false);

  const handleDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > DOC_MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(format(t.validation.documentSize, { mb: DOC_MAX_FILE_SIZE_MB }));
      e.target.value = "";
      return;
    }
    setDocUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/clinics/documents", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) {
        toast.error(data?.error ?? t.clinics.regDocFailed);
        return;
      }
      setDoc({ url: data.url, contentType: file.type });
    } catch {
      toast.error(t.clinics.regDocFailed);
    } finally {
      setDocUploading(false);
      e.target.value = "";
    }
  };

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
      setDoc(null);
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

      <div className="sm:col-span-2">
        <span className="text-foreground text-sm font-medium">
          {t.admin.newDentistDoc}
          <span className="text-coral"> *</span>
        </span>
        <input type="hidden" name="documentKind" value="licence" />
        <input type="hidden" name="documentUrl" value={doc?.url ?? ""} />
        <input type="hidden" name="documentType" value={doc?.contentType ?? ""} />
        <input
          type="file"
          accept={DOC_ACCEPT_ATTRIBUTE}
          onChange={handleDoc}
          disabled={docUploading}
          className="text-muted-foreground mt-1.5 block w-full text-sm"
        />
        {doc && <p className="text-teal-deep mt-1 text-xs">{t.clinics.regDocUploaded}</p>}
      </div>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={isPending || docUploading || !doc}
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
