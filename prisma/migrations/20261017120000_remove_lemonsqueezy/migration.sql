-- Lemon Squeezy is removed: it was built (20261004120000_lemonsqueezy) but never
-- switched on, so no row uses the LEMONSQUEEZY provider or its id columns.
-- If one ever did, the enum cast below fails and the migration stops untouched.
-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionProvider_new" AS ENUM ('PAYPLUS', 'STRIPE');
ALTER TABLE "ClinicSubscription" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "SubscriptionPricing" ALTER COLUMN "provider" TYPE "SubscriptionProvider_new" USING ("provider"::text::"SubscriptionProvider_new");
ALTER TABLE "ClinicSubscription" ALTER COLUMN "provider" TYPE "SubscriptionProvider_new" USING ("provider"::text::"SubscriptionProvider_new");
ALTER TYPE "SubscriptionProvider" RENAME TO "SubscriptionProvider_old";
ALTER TYPE "SubscriptionProvider_new" RENAME TO "SubscriptionProvider";
DROP TYPE "SubscriptionProvider_old";
ALTER TABLE "ClinicSubscription" ALTER COLUMN "provider" SET DEFAULT 'PAYPLUS';
COMMIT;

-- DropIndex
DROP INDEX "ClinicSubscription_lemonSqueezySubscriptionId_key";

-- DropIndex
DROP INDEX "SubscriptionCharge_lemonSqueezyInvoiceId_key";

-- AlterTable
ALTER TABLE "ClinicSubscription" DROP COLUMN "lemonSqueezyCustomerId",
DROP COLUMN "lemonSqueezySubscriptionId";

-- AlterTable
ALTER TABLE "SubscriptionCharge" DROP COLUMN "lemonSqueezyInvoiceId";

