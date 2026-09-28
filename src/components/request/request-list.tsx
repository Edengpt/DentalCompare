import { LocaleLink as Link } from "@/i18n/locale-link";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { requestBadge, type Badge } from "@/lib/request-badge";
import type { QuoteStatus, RequestStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { DeleteRequestButton } from "./delete-request-button";
import { StatusBadge } from "./status-badge";

export type RequestListRow = {
  id: string;
  status: RequestStatus;
  createdAt: Date;
  filesReady: boolean;
  /** Clinics the request went to. */
  recipients: number;
  /** One entry per quote a clinic actually sent. */
  quotes: QuoteStatus[];
};

/**
 * The patient's requests, split into what is still moving and what is done,
 * each wearing the one badge that says whether it is waiting on them.
 */
export function RequestList({
  t,
  locale,
  rows,
}: {
  t: Dictionary;
  locale: Locale;
  rows: RequestListRow[];
}) {
  const withBadges = rows.map((r) => ({ ...r, badge: requestBadge(r) }));
  // Anything waiting on the patient floats to the top of the active list; the
  // rest keep their newest-first order.
  const active = withBadges
    .filter((r) => !r.badge.past)
    .sort((a, b) => Number(b.badge.tone === "action") - Number(a.badge.tone === "action"));
  const past = withBadges.filter((r) => r.badge.past);

  return (
    <div className="mt-12 space-y-10">
      {active.length > 0 && (
        <Section title={t.dashboard.activeRequests} rows={active} t={t} locale={locale} />
      )}
      {past.length > 0 && (
        <Section title={t.dashboard.pastRequests} rows={past} t={t} locale={locale} muted />
      )}
    </div>
  );
}

function Section({
  title,
  rows,
  t,
  locale,
  muted,
}: {
  title: string;
  rows: (RequestListRow & { badge: Badge })[];
  t: Dictionary;
  locale: Locale;
  muted?: boolean;
}) {
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <section className="space-y-4">
      <h2 className="font-display text-foreground text-xl font-bold">{title}</h2>
      <ul
        className={cn(
          "divide-border/60 bg-card border-border/60 divide-y rounded-lg border",
          muted && "opacity-80",
        )}
      >
        {rows.map((r) => {
          const isSent = r.status === "SENT" || r.status === "SUBMITTED";
          // Sent requests are locked → read-only detail. Unfinished
          // requests link back into the flow so the user can complete them.
          const href = isSent
            ? `/request/${r.id}`
            : r.filesReady
              ? `/request/${r.id}/dentists`
              : `/request/${r.id}/upload`;
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="text-foreground font-semibold">
                    {t.dashboard.requestLabel} #{r.id.slice(0, 8)}
                  </p>
                  <StatusBadge tone={r.badge.tone}>{t.dashboard.badge[r.badge.key]}</StatusBadge>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {date.format(r.createdAt)}
                  {r.status === "SENT" &&
                    ` ✦ ${format(t.dashboard.quotesReceived, {
                      received: r.quotes.length,
                      total: r.recipients,
                    })}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Link
                  href={href}
                  className={cn(
                    "text-sm font-semibold underline-offset-4 hover:underline",
                    r.badge.tone === "action"
                      ? "bg-coral rounded-lg px-4 py-1.5 text-white hover:no-underline"
                      : "text-teal-deep",
                  )}
                >
                  {isSent ? t.dashboard.view : t.dashboard.continue}
                </Link>
                <DeleteRequestButton requestId={r.id} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
