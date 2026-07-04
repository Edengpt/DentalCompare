-- AlterTable
ALTER TABLE "RequestDentist" ADD COLUMN     "quoteToken" TEXT;

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "requestDentistId" TEXT NOT NULL,
    "amountILS" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_requestDentistId_key" ON "Quote"("requestDentistId");

-- CreateIndex
CREATE INDEX "Quote_requestDentistId_idx" ON "Quote"("requestDentistId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestDentist_quoteToken_key" ON "RequestDentist"("quoteToken");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_requestDentistId_fkey" FOREIGN KEY ("requestDentistId") REFERENCES "RequestDentist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
