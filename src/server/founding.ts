import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { FOUNDING_SLOTS } from "@/lib/founding";

/**
 * Founding places still open.
 *
 * A place is held from registration, so the countdown on the join page moves
 * the moment a clinic signs up rather than weeks later at approval. It is given
 * back when the clinic is rejected (the row is deleted) or cancels.
 *
 * Not locked against a simultaneous signup: two clinics registering in the
 * same second at place 50 can both get the price. Fifty-one founding clinics
 * is a cheaper outcome than serialising every registration.
 */
export async function foundingSlotsLeft(
  client: Prisma.TransactionClient | typeof db = db,
): Promise<number> {
  const taken = await client.clinicSubscription.count({
    where: { isFounding: true, status: { not: "CANCELED" } },
  });
  return Math.max(0, FOUNDING_SLOTS - taken);
}
