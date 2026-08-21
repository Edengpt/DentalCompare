-- Money migration M4: drop the legacy whole-shekel columns.
--
-- The last step of the four, and the only irreversible one. amountILS and
-- priceILS have been unread since M3 and kept only as a rollback net.
--
-- The spec deferred this until "a week of stable production", on the assumption
-- that a mistake in the money migration could mischarge a real card. That
-- assumption turned out not to hold: no payment provider has ever been
-- connected — PAYPLUS_API_KEY and friends are unset — and no real charge has
-- ever been taken. There is nothing to roll back to, so holding the columns
-- open bought nothing and cost a redundant write on every insert.
--
-- The minor-unit columns become NOT NULL in the same migration. Every row was
-- backfilled in M2 and every write path has set them since M3, so nothing can
-- be missing; making it explicit means a future write that forgets the currency
-- fails loudly at the database rather than rendering a price with no unit.

-- Quote
ALTER TABLE "Quote" DROP COLUMN "amountILS";
ALTER TABLE "Quote" ALTER COLUMN "amountMinor" SET NOT NULL;
ALTER TABLE "Quote" ALTER COLUMN "currency" SET NOT NULL;

-- ClinicSubscription
ALTER TABLE "ClinicSubscription" DROP COLUMN "priceILS";
ALTER TABLE "ClinicSubscription" ALTER COLUMN "priceMinor" SET NOT NULL;
ALTER TABLE "ClinicSubscription" ALTER COLUMN "currency" SET NOT NULL;

-- SubscriptionCharge
ALTER TABLE "SubscriptionCharge" DROP COLUMN "amountILS";
ALTER TABLE "SubscriptionCharge" ALTER COLUMN "amountMinor" SET NOT NULL;
ALTER TABLE "SubscriptionCharge" ALTER COLUMN "currency" SET NOT NULL;
