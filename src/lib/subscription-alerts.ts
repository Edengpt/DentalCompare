import type { Prisma } from "@/generated/prisma/client";

/**
 * Subscriptions an operator has to act on personally.
 *
 * A trial that ended with no way to charge it cannot resolve itself: either
 * PayPlus is unconfigured (ours to fix) or the clinic never opened its payment
 * link (someone has to ask it to). Everything else the renewal cron retries on
 * its own, which is why PAST_DUE is deliberately not here — it is a subscription
 * in progress, not a subscription waiting for a person.
 *
 * Shared between the sidebar badge and the subscriptions screen so the number in
 * the nav can never disagree with the rows the page marks. Two hand-written
 * copies of the same clause is exactly how the home page came to count clinics
 * the directory had stopped showing.
 */
export function needsOperatorAttentionWhere(): Prisma.ClinicSubscriptionWhereInput {
  return { trialEndedUnbilledAt: { not: null } };
}
