/**
 * What a clinic's subscription costs it per delivered request this month.
 *
 * The number a paying clinic weighs every month is "was it worth it", and it
 * reads that as a price per patient rather than as a subscription fee. A
 * yearly plan is spread over twelve months so the two plans compare fairly.
 * Returns null when there is nothing to divide: no requests yet, or a free
 * plan that costs nothing.
 */
export function costPerRequestMinor(
  priceMinor: number,
  plan: "MONTHLY" | "YEARLY",
  requestsThisMonth: number,
): number | null {
  if (priceMinor <= 0 || requestsThisMonth <= 0) return null;
  const monthlyMinor = plan === "YEARLY" ? priceMinor / 12 : priceMinor;
  return Math.round(monthlyMinor / requestsThisMonth);
}

/** The first day of next month (UTC), when monthly request caps reset. */
export function nextMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}
