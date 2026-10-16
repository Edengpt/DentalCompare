import "server-only";
import { db } from "@/lib/db";
import { currentYearMonth } from "@/lib/date";

/**
 * Records that a request was actually delivered to a clinic: the lifetime
 * count on ClinicSubscription and this month's MonthlyRequestUsage row, which
 * the monthly request cap reads. Called once per (request, clinic) pair, right
 * after fulfillment.ts confirms the email to that clinic actually sent.
 *
 * Counting never ends a free trial. The trial is a plain number of days from
 * approval (2026-10-16): a clinic that gets five requests in its first week
 * is still not charged until the day its terms named.
 */
export async function recordVerifiedRequest(dentistId: string): Promise<void> {
  const yearMonth = currentYearMonth();

  await db.$transaction([
    db.clinicSubscription.update({
      where: { dentistId },
      data: { verifiedRequestCount: { increment: 1 } },
      select: { id: true },
    }),
    db.monthlyRequestUsage.upsert({
      where: { dentistId_yearMonth: { dentistId, yearMonth } },
      create: { dentistId, yearMonth, count: 1 },
      update: { count: { increment: 1 } },
    }),
  ]);
}
