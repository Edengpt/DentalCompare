-- AlterTable
ALTER TABLE "ClinicSubscription" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "priceMinor" INTEGER;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "amountMinor" INTEGER,
ADD COLUMN     "currency" TEXT;

-- AlterTable
ALTER TABLE "SubscriptionCharge" ADD COLUMN     "amountMinor" INTEGER,
ADD COLUMN     "currency" TEXT;
