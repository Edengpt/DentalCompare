"use client";

import { useRouter } from "next/navigation";
import { QuoteForm, type QuoteFormInitial } from "@/components/quote/quote-form";

/**
 * The quote builder inside the clinic's own area. Same form as the emailed link;
 * the only difference is that once it is sent, the page's statuses refresh in
 * place — the badge flips to "quote sent" without a reload.
 */
export function ClinicQuotePanel({
  token,
  currencyLabel,
  initial,
}: {
  token: string;
  currencyLabel: string;
  initial: QuoteFormInitial;
}) {
  const router = useRouter();
  return (
    <QuoteForm
      token={token}
      currencyLabel={currencyLabel}
      initial={initial}
      onSubmitted={() => router.refresh()}
    />
  );
}
