"use client";

import { useTransition } from "react";
import { ForwardArrow } from "@/components/ui/forward-arrow";
import { useT } from "@/i18n/provider";
import { toast } from "sonner";
import { startPayment } from "@/server/billing-actions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function StartPaymentButton({ setupToken }: { setupToken: string }) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await startPayment(setupToken);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          window.location.href = result.url;
        })
      }
      className={cn(
        buttonVariants(),
        "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 font-semibold disabled:opacity-50",
      )}
    >
      {isPending ? t.clinics.payRedirecting : t.clinics.payCta}
      <ForwardArrow className="h-4 w-4" />
    </button>
  );
}
