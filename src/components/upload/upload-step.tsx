"use client";

import { useT } from "@/i18n/provider";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recordConsent } from "@/server/consent-actions";
import { LocaleLink as Link } from "@/i18n/locale-link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { FileDropzone } from "./file-dropzone";

type UploadStepProps = {
  requestId: string;
  initialTreatmentUrl: string | null;
  initialXrayUrl: string | null;
  /** True once consent has already been recorded for this request. */
  initialConsented: boolean;
};

export function UploadStep({
  requestId,
  initialTreatmentUrl,
  initialXrayUrl,
  initialConsented,
}: UploadStepProps) {
  const t = useT();
  const [treatmentUrl, setTreatmentUrl] = useState<string | null>(initialTreatmentUrl);
  const [xrayUrl, setXrayUrl] = useState<string | null>(initialXrayUrl);
  const [consented, setConsented] = useState(initialConsented);
  const [, startConsent] = useTransition();

  // Recorded the moment it is ticked rather than on continue: consent is a fact
  // about a point in time, and the server is the only place that can date it.
  // Unticking does not withdraw it — withdrawal is deletion, which is its own
  // action.
  const handleConsent = (checked: boolean) => {
    setConsented(checked);
    if (!checked) return;
    startConsent(async () => {
      const result = await recordConsent(requestId);
      if (!result.ok) {
        setConsented(false);
        toast.error(t.upload.consentSaveFailed);
      }
    });
  };

  const canContinue = !!treatmentUrl && !!xrayUrl && consented;

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-foreground text-xl font-bold">
            {t.upload.treatmentPlanTitle}
          </h2>
          <span className="text-muted-foreground text-xs">{t.upload.required}</span>
        </div>
        <FileDropzone
          kind="treatment"
          requestId={requestId}
          initialUrl={treatmentUrl}
          onUploaded={setTreatmentUrl}
          description={t.upload.treatmentPlanDescription}
        />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-foreground text-xl font-bold">{t.upload.xrayTitle}</h2>
          <span className="text-muted-foreground text-xs">{t.upload.required}</span>
        </div>
        <FileDropzone
          kind="xray"
          requestId={requestId}
          initialUrl={xrayUrl}
          onUploaded={setXrayUrl}
          description={t.upload.xrayDescription}
        />
      </section>

      {/* Separate from every other agreement on purpose: bundling consent for
          health data with anything else is what makes it not count. */}
      <section className="border-border/60 bg-muted/30 rounded-2xl border p-5">
        <h2 className="font-display text-foreground text-base font-bold">
          {t.upload.consentTitle}
        </h2>
        <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => handleConsent(e.target.checked)}
            className="accent-teal-deep mt-0.5 h-4 w-4 shrink-0"
          />
          <span className="text-foreground leading-relaxed">
            {t.upload.consentLabel}{" "}
            <Link
              href="/privacy"
              className="text-teal-deep underline underline-offset-4"
              target="_blank"
            >
              {t.upload.consentReadMore}
            </Link>
          </span>
        </label>
      </section>

      <div className="border-border/60 flex flex-col-reverse items-stretch justify-between gap-4 border-t pt-8 sm:flex-row sm:items-center">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center text-sm font-medium underline-offset-4 hover:underline"
        >
          {t.upload.saveForLater}
        </Link>

        <Link
          href={canContinue ? `/request/${requestId}/travel` : "#"}
          aria-disabled={!canContinue}
          tabIndex={canContinue ? 0 : -1}
          onClick={(e) => {
            if (!canContinue) e.preventDefault();
          }}
          className={cn(
            buttonVariants(),
            "inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold",
            canContinue
              ? "bg-teal-deep hover:bg-teal-deep/90 text-cream"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          {t.upload.continueToDentists}
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
