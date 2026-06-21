"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { FileDropzone } from "./file-dropzone";

type UploadStepProps = {
  requestId: string;
  initialTreatmentUrl: string | null;
  initialXrayUrl: string | null;
};

export function UploadStep({ requestId, initialTreatmentUrl, initialXrayUrl }: UploadStepProps) {
  const [treatmentUrl, setTreatmentUrl] = useState<string | null>(initialTreatmentUrl);
  const [xrayUrl, setXrayUrl] = useState<string | null>(initialXrayUrl);

  const canContinue = !!treatmentUrl && !!xrayUrl;

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-foreground text-xl font-bold">תוכנית טיפול</h2>
          <span className="text-muted-foreground text-xs">חובה</span>
        </div>
        <FileDropzone
          kind="treatment"
          requestId={requestId}
          initialUrl={treatmentUrl}
          onUploaded={setTreatmentUrl}
          description="המסמך שקיבלתם מרופא השיניים שלכם עם פירוט הטיפולים והעלויות"
        />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-foreground text-xl font-bold">צילומי שיניים</h2>
          <span className="text-muted-foreground text-xs">חובה</span>
        </div>
        <FileDropzone
          kind="xray"
          requestId={requestId}
          initialUrl={xrayUrl}
          onUploaded={setXrayUrl}
          description="פנורמי, סטטוס, או צילום נקודתי מהמרפאה שביצעה אבחון"
        />
      </section>

      <div className="border-border/60 flex flex-col-reverse items-stretch justify-between gap-4 border-t pt-8 sm:flex-row sm:items-center">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center text-sm font-medium underline-offset-4 hover:underline"
        >
          שמירה והמשך מאוחר יותר
        </Link>

        <Link
          href={canContinue ? `/request/${requestId}/dentists` : "#"}
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
          המשך לבחירת רופאים
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
