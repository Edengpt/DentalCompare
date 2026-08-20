import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// The seed runs outside Next, so nothing has loaded .env.local for it. Mirrors
// the order in prisma.config.ts.
config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Countries ARE seeded. Clinics are NOT.
 *
 * A country is reference data the app cannot start without — every User and
 * Dentist has a foreign key into it — and Israel is the country every existing
 * row already points at. Adding any further country is an admin action, never a
 * code change: that is the whole point of the Country table.
 *
 * Clinics remain unseeded, for the reason they always have been. The platform
 * emails patients' treatment plans and x-rays to the addresses on file, so
 * every clinic email must be a real, consenting recipient. The only way in is
 * the real onboarding flow:
 *   1. The clinic registers itself via the intake form (/clinics/join)
 *   2. A system admin approves it (/admin/clinics)
 *   3. It then becomes visible in the patient-facing directory
 * An admin can still add a clinic by hand when onboarding one off-form.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

// Prisma 7 requires an explicit driver adapter — the same one src/lib/db.ts
// builds. A bare `new PrismaClient()` throws at construction.
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  // Mirrors the INSERT in the country_model migration. Both are idempotent:
  // the migration can't rely on the seed having run, and the seed has to work
  // on a database created from scratch.
  await db.country.upsert({
    where: { code: "IL" },
    update: {},
    create: {
      code: "IL",
      nameEn: "Israel",
      currency: "ILS",
      callingCode: "972",
      defaultLocale: "he",
      insurers: ["Clalit", "Maccabi", "Meuhedet", "Leumit"],
      requiredDocs: ["dental_licence", "business_registration"],
      isActive: true,
    },
  });

  console.log("✅ Seeded country: IL");
  console.log(
    "ℹ️  No clinic seed data. Clinics are added via the intake form + admin approval (or admin manual-add).",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
