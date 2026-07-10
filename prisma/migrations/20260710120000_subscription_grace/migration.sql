-- Subscription grace period + return-page verification (Step 9).
-- Additive, nullable columns — no data backfill needed.
ALTER TABLE "ClinicSubscription" ADD COLUMN "pageRequestUid" TEXT;
ALTER TABLE "ClinicSubscription" ADD COLUMN "paymentFailedNotifiedAt" TIMESTAMP(3);
