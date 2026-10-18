-- Index cleanup (production-readiness review, 2026-10-18).
--
-- Add: Dentist.countryCode is a foreign key filtered on by the clinic directory
-- and by dispatch (travel scope). Postgres does not index foreign keys on its own.
CREATE INDEX IF NOT EXISTS "Dentist_countryCode_idx" ON "Dentist"("countryCode");

-- Drop: each duplicates an index Postgres already keeps — a @unique constraint
-- on the same column, or a composite whose leftmost column it is. They only add
-- write cost.
DROP INDEX IF EXISTS "User_clerkUserId_idx";
DROP INDEX IF EXISTS "Dentist_clerkUserId_idx";
DROP INDEX IF EXISTS "Quote_requestDentistId_idx";
DROP INDEX IF EXISTS "RequestDentist_dentistId_idx";
