"use client";

import { useTransition } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createCheckoutSession } from "@/server/payments";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type PayButtonProps = {
  requestId: string;
  amount: number;
  testMode?: boolean;
};

export function PayButton({ requestId, amount, testMode = false }: PayButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await createCheckoutSession(requestId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.url;
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        buttonVariants(),
        "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold",
        isPending && "cursor-wait opacity-80",
      )}
    >
      {isPending ? (
        <>
          מעבירים לתשלום…
          <Loader2 className="h-4 w-4 animate-spin" />
        </>
      ) : (
        <>
          {testMode ? `שליחה (מצב בדיקה — ללא חיוב)` : `לתשלום ושליחה (${amount} ₪)`}
          <ArrowLeft className="h-4 w-4" />
        </>
      )}
    </button>
  );
}
