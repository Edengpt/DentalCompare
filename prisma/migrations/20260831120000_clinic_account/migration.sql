-- The Clerk account that signs in as a clinic.
--
-- Nullable: every existing clinic predates accounts entirely, and a clinic
-- recruited by phone may never have one. Unique so a single account can never
-- speak for two clinics.
ALTER TABLE "Dentist" ADD COLUMN "clerkUserId" TEXT;

CREATE UNIQUE INDEX "Dentist_clerkUserId_key" ON "Dentist"("clerkUserId");
CREATE INDEX "Dentist_clerkUserId_idx" ON "Dentist"("clerkUserId");
