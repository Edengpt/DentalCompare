"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, Info, Mail, MessageCircle, Phone, PlayCircle } from "lucide-react";
import { useLocale, useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { formatPhoneForDisplay, whatsappHref } from "@/lib/phone";
import { treatmentTimeline, type TimelineInput } from "@/lib/treatment-timeline";
import { markTreatmentStarted, requestCompletionConfirmation } from "@/server/quote-decisions";
import { ConfirmDialog } from "@/components/request/confirm-dialog";
import { StatusBadge } from "@/components/request/status-badge";
import { TreatmentTimelineList } from "@/components/request/treatment-timeline-list";

export type TreatmentPatient = {
  name: string;
  phone: string | null;
  phoneVerified: boolean;
  /** Only once the patient chose this clinic — never before. */
  email: string | null;
};

type Pending = "start" | "complete" | null;

/**
 * The clinic's side of a treatment the patient chose it for: how to reach the
 * patient to book them in, where the treatment stands, and the one step the
 * clinic can take next.
 */
export function ClinicTreatmentCard({
  requestDentistId,
  patient,
  timeline,
  completionDeclinedAt,
}: {
  requestDentistId: string;
  patient: TreatmentPatient;
  timeline: TimelineInput;
  /** When the patient last answered a completion request with "still ongoing". */
  completionDeclinedAt: Date | null;
}) {
  const t = useT();
  const c = t.clinics;
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<Pending>(null);
  const steps = treatmentTimeline(timeline);
  const whatsapp = whatsappHref(patient.phone);

  const contacts = [
    ...(patient.phone
      ? [
          {
            icon: Phone,
            label: t.requestDetail.contactCall,
            value: formatPhoneForDisplay(patient.phone),
            href: `tel:${patient.phone}`,
          },
        ]
      : []),
    ...(whatsapp
      ? [
          {
            icon: MessageCircle,
            label: t.requestDetail.contactWhatsapp,
            value: formatPhoneForDisplay(patient.phone),
            href: whatsapp,
          },
        ]
      : []),
    ...(patient.email
      ? [
          {
            icon: Mail,
            label: t.requestDetail.contactEmail,
            value: patient.email,
            href: `mailto:${patient.email}`,
          },
        ]
      : []),
  ];

  const run = (action: (id: string) => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await action(requestDentistId);
      setConfirming(null);
      if (!result.ok) toast.error(result.error ?? c.dashLeadActionFailed);
      else router.refresh();
    });

  // A "still ongoing" answer matters only while the treatment is back in
  // progress — once the clinic asks again or it completes, it is history.
  const showDeclined = completionDeclinedAt !== null && timeline.status === "IN_TREATMENT";

  return (
    <section className="border-teal-deep/30 bg-card overflow-hidden rounded-lg border">
      <div className="bg-teal-deep text-cream flex flex-wrap items-end justify-between gap-3 px-6 py-5">
        <div>
          <p className="text-cream/70 text-xs font-medium">{c.ctEyebrow}</p>
          <h2 className="font-display mt-1 text-2xl font-bold">
            {format(c.ctTitle, { patient: patient.name })}
          </h2>
        </div>
      </div>

      <div className="grid gap-8 p-6 md:grid-cols-2">
        <div>
          <h3 className="text-foreground text-sm font-semibold">{c.ctContactTitle}</h3>
          <p className="text-muted-foreground mt-1 text-xs">{c.ctContactHint}</p>
          <ul className="mt-4 space-y-2">
            {contacts.map((ct) => (
              <li key={ct.label}>
                <a
                  href={ct.href}
                  target={ct.href.startsWith("http") ? "_blank" : undefined}
                  rel={ct.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="border-border/60 hover:border-teal-deep/40 hover:bg-teal-deep/5 flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors"
                >
                  <ct.icon className="text-teal-deep h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="text-foreground block text-sm font-semibold">{ct.label}</span>
                    <span dir="ltr" className="text-muted-foreground block truncate text-xs">
                      {ct.value}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {patient.phone && (
            <p className="text-muted-foreground mt-2 text-xs">
              {patient.phoneVerified ? c.reqPhoneVerified : c.reqPhoneUnverified}
            </p>
          )}
        </div>

        <div>
          <h3 className="text-foreground text-sm font-semibold">{t.requestDetail.timelineTitle}</h3>
          <div className="mt-4">
            <TreatmentTimelineList
              steps={steps}
              labels={c.ctTimeline}
              next={c.ctTimelineNext}
              byLabel={(by) => (by === "CLINIC" ? c.ctStartedByYou : c.ctStartedByPatient)}
            />
          </div>

          {showDeclined && (
            <p className="bg-muted/50 text-foreground mt-5 flex gap-2 rounded-lg p-3.5 text-sm">
              <Info className="text-teal-deep mt-0.5 h-4 w-4 shrink-0" />
              {format(c.ctDeclined, {
                date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(
                  completionDeclinedAt!,
                ),
              })}
            </p>
          )}

          <div className="mt-6">
            {timeline.status === "APPROVED" && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirming("start")}
                className="bg-teal-deep text-cream hover:bg-teal-deep/90 inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-bold disabled:opacity-50"
              >
                <PlayCircle className="h-4 w-4" />
                {c.ctMarkStarted}
              </button>
            )}
            {timeline.status === "IN_TREATMENT" && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirming("complete")}
                className="bg-coral hover:bg-coral/90 inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-bold text-white disabled:opacity-50"
              >
                <BellRing className="h-4 w-4" />
                {c.ctRequestCompletion}
              </button>
            )}
            {timeline.status === "COMPLETION_REQUESTED" && (
              <StatusBadge tone="waiting">{c.leadStage.awaitingPatient}</StatusBadge>
            )}
            {timeline.status === "COMPLETED" && (
              <StatusBadge tone="positive">{c.leadStage.completed}</StatusBadge>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        onCancel={() => setConfirming(null)}
        onConfirm={() =>
          run(confirming === "complete" ? requestCompletionConfirmation : markTreatmentStarted)
        }
        pending={isPending}
        title={format(
          confirming === "complete" ? c.ctConfirmCompleteTitle : c.ctConfirmStartTitle,
          {
            patient: patient.name,
          },
        )}
        confirmLabel={confirming === "complete" ? c.ctConfirmCompleteYes : c.ctConfirmStartYes}
        // The patient can answer "still ongoing", so asking is not final.
        irreversible={confirming === "start"}
      >
        <p>{confirming === "complete" ? c.ctConfirmCompleteBody : c.ctConfirmStartBody}</p>
      </ConfirmDialog>
    </section>
  );
}
