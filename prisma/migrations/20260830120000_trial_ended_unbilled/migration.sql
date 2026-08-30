-- A trial that ends with no way to charge (PayPlus unconfigured, or no stored
-- card) leaves the clinic TRIALING and visible on purpose. This column is the
-- only record that the free period is over, so the admin screen can show it and
-- the alert fires once instead of every daily cron run.
ALTER TABLE "ClinicSubscription" ADD COLUMN "trialEndedUnbilledAt" TIMESTAMP(3);
