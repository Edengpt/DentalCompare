-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "daysPerTrip" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "includes" TEXT[],
ADD COLUMN     "tripsRequired" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "warrantyNote" TEXT,
ADD COLUMN     "warrantyYears" INTEGER,
ADD COLUMN     "weeksBetweenTrips" INTEGER;
