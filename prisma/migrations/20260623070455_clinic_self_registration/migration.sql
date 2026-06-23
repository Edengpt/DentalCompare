-- AlterTable
ALTER TABLE "Dentist" ADD COLUMN     "agreedToTermsAt" TIMESTAMP(3),
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "submittedBySelf" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "termsVersion" TEXT;

-- CreateIndex
CREATE INDEX "Dentist_submittedBySelf_idx" ON "Dentist"("submittedBySelf");
