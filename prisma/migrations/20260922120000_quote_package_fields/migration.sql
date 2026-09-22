-- Package-pricing fields on Quote: how many nights of accommodation the
-- price covers (meaningful only when `includes` contains "ACCOMMODATION"),
-- and how many separate clinic visits the treatment itself needs,
-- independent of travel (tripsRequired). All additive — existing rows get
-- the same one-trip/one-session default tripsRequired already uses.
ALTER TABLE "Quote" ADD COLUMN "accommodationNights" INTEGER;
ALTER TABLE "Quote" ADD COLUMN "sessionsRequired" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Quote" ADD COLUMN "weeksBetweenSessions" INTEGER;
