"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Mail, MapPin, MessageCircle, Phone, PlayCircle } from "lucide-react";
import { useLocale, useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { markTreatmentStartedByPatient } from "@/server/quote-decisions";
import { treatmentTimeline, type TimelineInput } from "@/lib/treatment-timeline";
import { ConfirmDialog } from "./confirm-dialog";

export type TreatmentClinic = {
  clinicName: string;
  dentistName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  country: string | null;
};

// A number stored in international form can open a WhatsApp chat; a number
// kept as the clinic typed it (the fallback when it couldn't be parsed) can't
// be trusted to, so the button is simply not offered.
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Everything the patient needs once a clinic is chosen: how to reach it, where
 * the treatment stands, and — until someone marks it — the button to say it
 * has started.
 */
export function TreatmentCard({
  requestDentistId,
  clinic,
  timeline,
}: {
  requestDentistId: string;
  clinic: TreatmentClinic;
  timeline: TimelineInput;
}) {
  const t = useT().requestDetail;
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const steps = treatmentTimeline(timeline);
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" });

  const mapQuery = [clinic.address, clinic.city, clinic.country].filter(Boolean).join(", ");
  const contacts = [
    { icon: Phone, label: t.contactCall, value: clinic.phone, href: `tel:${clinic.phone}` },
    ...(E164.test(clinic.phone)
      ? [
          {
            icon: MessageCircle,
            label: t.contactWhatsapp,
            value: clinic.phone,
            href: `https://wa.me/${clinic.phone.slice(1)}`,
          },
        ]
      : []),
    { icon: Mail, label: t.contactEmail, value: clinic.email, href: `mailto:${clinic.email}` },
    {
      icon: MapPin,
      label: t.contactMap,
      value: [clinic.address, clinic.city].filter(Boolean).join(", "),
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`,
    },
  ];

  const start = () =>
    startTransition(async () => {
      const result = await markTreatmentStartedByPatient(requestDentistId);
      setConfirming(false);
      if (!result.ok) toast.error(result.error ?? t.quoteActionFailed);
    });

  return (
    <section className="border-teal-deep/30 bg-card overflow-hidden rounded-3xl border">
      <div className="bg-teal-deep text-cream px-6 py-5">
        <p className="text-cream/70 text-xs font-medium">{t.treatmentEyebrow}</p>
        <h2 className="font-display mt-1 text-2xl font-bold">
          {format(t.treatmentTitle, { clinic: clinic.clinicName })}
        </h2>
        <p className="text-cream/80 mt-0.5 text-sm">{clinic.dentistName}</p>
      </div>

      <div className="grid gap-8 p-6 md:grid-cols-2">
        <div>
          <h3 className="text-foreground text-sm font-semibold">{t.contactTitle}</h3>
          <p className="text-muted-foreground mt-1 text-xs">{t.contactHint}</p>
          <ul className="mt-4 space-y-2">
            {contacts.map((c) => (
              <li key={c.label}>
                <a
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="border-border/60 hover:border-teal-deep/40 hover:bg-teal-deep/5 flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors"
                >
                  <c.icon className="text-teal-deep h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="text-foreground block text-sm font-semibold">{c.label}</span>
                    {/* Phone numbers and emails read left-to-right on an RTL page. */}
                    <span dir="ltr" className="text-muted-foreground block truncate text-xs">
                      {c.value}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-foreground text-sm font-semibold">{t.timelineTitle}</h3>
          <ol className="mt-4">
            {steps.map((s, i) => (
              <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
                {i < steps.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute start-[11px] top-7 h-[calc(100%-1.5rem)] w-0.5",
                      s.state === "done" ? "bg-teal-deep" : "bg-border",
                    )}
                  />
                )}
                <span className="relative z-10 shrink-0">
                  {s.state === "done" && (
                    <span className="bg-teal-deep text-cream flex h-6 w-6 items-center justify-center rounded-full">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                  {s.state === "current" && (
                    <span className="border-coral bg-card flex h-6 w-6 items-center justify-center rounded-full border-2">
                      <span className="bg-coral h-2.5 w-2.5 animate-pulse rounded-full" />
                    </span>
                  )}
                  {s.state === "upcoming" && (
                    <span className="border-border bg-card block h-6 w-6 rounded-full border-2" />
                  )}
                </span>
                <div aria-current={s.state === "current" ? "step" : undefined}>
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      s.state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {t.timeline[s.key]}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {s.at
                      ? date.format(s.at) +
                        (s.by
                          ? ` ✦ ${s.by === "PATIENT" ? t.startedByYou : t.startedByClinic}`
                          : "")
                      : s.key !== "approved" && t.timelineNext[s.key]}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {timeline.status === "APPROVED" && (
            <div className="bg-muted/40 mt-6 rounded-2xl p-4">
              <p className="text-muted-foreground text-sm">{t.markStartedHint}</p>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirming(true)}
                className="bg-teal-deep text-cream hover:bg-teal-deep/90 mt-3 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                <PlayCircle className="h-4 w-4" />
                {t.markStarted}
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={start}
        pending={isPending}
        title={format(t.confirmStartTitle, { clinic: clinic.clinicName })}
        confirmLabel={t.confirmStartYes}
      >
        <p>{t.confirmStartBody}</p>
      </ConfirmDialog>
    </section>
  );
}
