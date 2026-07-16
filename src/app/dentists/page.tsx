import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The dentist directory is not a standalone, browsable destination. It only
// appears as an in-journey step at /request/[id]/dentists (choosing clinics to
// compare after a request is started). Anyone hitting /dentists directly — e.g.
// by typing the URL — is sent to the landing page to begin properly.
export default function DentistsPage() {
  redirect("/");
}
