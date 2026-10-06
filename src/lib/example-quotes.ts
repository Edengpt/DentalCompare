/**
 * The made-up quotes the homepage shows twice: as the full example comparison
 * and as the miniature table in "How it works". One list, so the two can never
 * show different numbers. None of these is a price on offer — every place they
 * appear says they are examples.
 */
export const EXAMPLE_QUOTES = [
  { id: "A", amount: 2400, currency: "GBP", rating: 4.8, lowest: false },
  { id: "B", amount: 950, currency: "EUR", rating: 4.6, lowest: true },
  { id: "C", amount: 1450, currency: "EUR", rating: null, lowest: false },
] as const;

export type ExampleQuote = (typeof EXAMPLE_QUOTES)[number];

export function formatExampleMoney(locale: string, amount: number, currency: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
