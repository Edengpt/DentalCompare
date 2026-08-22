-- fullName stops being a required column.
--
-- It was never really the patient's name: sign-up collects only an email and a
-- password, so getOrCreateUser fell back to writing the email address into it.
-- That value is what the dentist reads on the quote page and in the email
-- asking them to price the treatment.
--
-- Null means "not known", which is both true and already handled by every
-- reader — a request whose patient deleted their account has had a null user
-- since the free-patient pivot.
ALTER TABLE "User" ALTER COLUMN "fullName" DROP NOT NULL;

-- Rows whose name is really just their email address. Reversible in the sense
-- that matters: the email is still in the row next to it.
UPDATE "User" SET "fullName" = NULL WHERE "fullName" = "email";
