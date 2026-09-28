-- Either side may mark a treatment as started; the other side is emailed.
CREATE TYPE "TreatmentActor" AS ENUM ('PATIENT', 'CLINIC');

-- treatmentStartedBy: who marked the start (null = pre-existing rows, the clinic).
-- completionDeclined*: the patient answered a completion request with "still ongoing".
ALTER TABLE "Quote" ADD COLUMN "treatmentStartedBy" "TreatmentActor",
ADD COLUMN "completionDeclinedAt" TIMESTAMP(3),
ADD COLUMN "completionDeclinedNotifiedAt" TIMESTAMP(3);
