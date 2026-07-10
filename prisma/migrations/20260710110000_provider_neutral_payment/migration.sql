-- Provider-neutral payment schema (Step 1).
-- Data-preserving on purpose: existing Payment rows are kept by RENAMEing columns
-- and converting amount -> agorot in place, rather than drop+add. Payment/
-- SubscriptionCharge status move onto a dedicated PaymentStatus enum, and the
-- user FKs become ON DELETE SET NULL so financial records survive user deletion.

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- Payment: rename stripeSessionId -> providerRef (keep data + unique index)
ALTER TABLE "Payment" RENAME COLUMN "stripeSessionId" TO "providerRef";
ALTER INDEX "Payment_stripeSessionId_key" RENAME TO "Payment_providerRef_key";

-- Payment: amount (Float ILS) -> amountAgorot (Int), value = ROUND(amount * 100)
ALTER TABLE "Payment" ADD COLUMN "amountAgorot" INTEGER;
UPDATE "Payment" SET "amountAgorot" = ROUND("amount" * 100)::integer;
ALTER TABLE "Payment" ALTER COLUMN "amountAgorot" SET NOT NULL;
ALTER TABLE "Payment" DROP COLUMN "amount";

-- Payment.status: RequestStatus -> PaymentStatus (members are identical)
ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus" USING ("status"::text::"PaymentStatus");
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- SubscriptionCharge.status: RequestStatus -> PaymentStatus
ALTER TABLE "SubscriptionCharge" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SubscriptionCharge" ALTER COLUMN "status" TYPE "PaymentStatus" USING ("status"::text::"PaymentStatus");
ALTER TABLE "SubscriptionCharge" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Payment.userId: nullable + ON DELETE SET NULL (preserve the financial record)
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey";
ALTER TABLE "Payment" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Request.userId: nullable + ON DELETE SET NULL
ALTER TABLE "Request" DROP CONSTRAINT "Request_userId_fkey";
ALTER TABLE "Request" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Request" ADD CONSTRAINT "Request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
