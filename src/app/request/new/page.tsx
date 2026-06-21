import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/server/users";

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/request/new");

  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");

  // Reuse the most recent PENDING request if one exists without files yet —
  // saves users from creating multiple empty requests on accidental refresh.
  const existing = await db.request.findFirst({
    where: {
      userId: user.id,
      status: "PENDING",
      treatmentFileUrl: "",
      xrayFileUrl: "",
    },
    orderBy: { createdAt: "desc" },
  });

  const requestId =
    existing?.id ??
    (
      await db.request.create({
        data: {
          userId: user.id,
          treatmentFileUrl: "",
          xrayFileUrl: "",
        },
        select: { id: true },
      })
    ).id;

  redirect(`/request/${requestId}/upload`);
}
