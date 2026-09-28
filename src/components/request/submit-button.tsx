"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ForwardArrow } from "@/components/ui/forward-arrow";
import { useT } from "@/i18n/provider";
import { toast } from "sonner";
import { submitRequest } from "@/server/requests";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type SubmitButtonProps = {
  requestId: string;
};

/**
 * Sends the request to the selected clinics. Replaces the old PayButton — the
 * patient is never charged (PRD 4.1), so this goes straight to delivery instead
 * of redirecting to a payment provider.
 */
export function SubmitButton({ requestId }: SubmitButtonProps) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    startTransition(async () => {
      const result = await submitRequest(requestId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/request/${requestId}/success`);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        buttonVariants(),
        "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-12 items-center justify-center gap-2 rounded-lg px-7 text-base font-semibold",
        isPending && "cursor-wait opacity-80",
      )}
    >
      {isPending ? (
        <>
          {t.submitButton.sending}
          <Loader2 className="h-4 w-4 animate-spin" />
        </>
      ) : (
        <>
          {t.submitButton.submit}
          <ForwardArrow className="h-4 w-4" />
        </>
      )}
    </button>
  );
}
