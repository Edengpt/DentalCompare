"use client";

import { useState } from "react";
import { LocaleLink as Link } from "@/i18n/locale-link";
import { useLocale, useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { LEAD_TABS, type LeadStage, type LeadTab } from "@/lib/clinic-lead-stage";
import type { BadgeTone } from "@/lib/request-badge";
import { StatusBadge } from "@/components/request/status-badge";
import { ForwardArrow } from "@/components/ui/forward-arrow";

export type IncomingLead = {
  /** The RequestDentist id — what the clinic's request page is keyed by. */
  id: string;
  requestId: string;
  receivedAt: Date | null;
  stage: LeadStage;
  tone: BadgeTone;
};

const TAB_ORDER: LeadTab[] = ["action", "all", "sent", "treatment", "closed"];

/**
 * The clinic's "reservations" list: every request delivered to it, filterable by
 * where it stands, with what needs the clinic's attention first.
 */
export function IncomingRequests({ leads }: { leads: IncomingLead[] }) {
  const t = useT().clinics;
  const locale = useLocale();
  const actionCount = leads.filter((l) => LEAD_TABS.action.includes(l.stage)).length;
  // Open on what needs doing, when anything does.
  const [tab, setTab] = useState<LeadTab>(actionCount > 0 ? "action" : "all");
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });

  const shown = leads
    .filter((l) => LEAD_TABS[tab].includes(l.stage))
    .sort((a, b) => Number(b.tone === "action") - Number(a.tone === "action"));

  return (
    <div>
      <div role="tablist" className="border-border/60 -mx-1 flex gap-1 overflow-x-auto border-b">
        {TAB_ORDER.map((key) => {
          const count = leads.filter((l) => LEAD_TABS[key].includes(l.stage)).length;
          const selected = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(key)}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                selected
                  ? "border-teal-deep text-teal-deep"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {t.reqTabs[key]}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs",
                  key === "action" && count > 0
                    ? "bg-highlight text-on-highlight"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">{t.reqEmptyTab}</p>
      ) : (
        <ul role="tabpanel" className="divide-border/60 divide-y">
          {shown.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/clinics/requests/${lead.id}`}
                className="group hover:bg-muted/40 -mx-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg px-2 py-3.5 transition-colors"
              >
                <span className="text-foreground font-mono text-sm font-semibold">
                  #{lead.requestId.slice(0, 8)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {lead.receivedAt
                    ? format(t.dashLeadReceived, { date: date.format(lead.receivedAt) })
                    : ""}
                </span>
                <span className="ms-auto flex items-center gap-2">
                  <StatusBadge tone={lead.tone}>{t.leadStage[lead.stage]}</StatusBadge>
                  <ForwardArrow className="text-muted-foreground h-4 w-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
