/**
 * Seed is intentionally empty.
 *
 * Clinics are NOT seeded with placeholder data. The only way a clinic enters the
 * platform is the real onboarding flow:
 *   1. The clinic registers itself via the intake form (/clinics/join)
 *   2. A system admin approves it (/admin/clinics)
 *   3. It then becomes visible in the patient-facing directory
 *
 * Seeding fake clinics is unsafe: the platform emails patients' treatment plans
 * and x-rays to the addresses on file, so every clinic email must be a real,
 * consenting recipient. Admins can still add a clinic manually from the admin
 * panel when onboarding one off-form.
 */
async function main() {
  console.log(
    "ℹ️  No seed data. Clinics are added via the intake form + admin approval (or admin manual-add).",
  );
}

main();
