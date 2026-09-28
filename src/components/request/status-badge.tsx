import type { BadgeTone } from "@/lib/request-badge";
import { cn } from "@/lib/utils";

const TONES: Record<BadgeTone, string> = {
  // The only loud one: it means "this is waiting on you".
  action: "bg-highlight text-on-highlight",
  waiting: "bg-teal/10 text-teal",
  positive: "bg-teal-deep/10 text-teal-deep",
  neutral: "bg-muted text-muted-foreground",
  danger: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        TONES[tone],
      )}
    >
      {tone === "action" && (
        <span aria-hidden className="bg-on-highlight h-1.5 w-1.5 animate-pulse rounded-full" />
      )}
      {children}
    </span>
  );
}
