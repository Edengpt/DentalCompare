import { formatMoney } from "@/lib/money";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Users,
  CheckCircle2,
  Clock,
  Mail,
} from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { sortByPrice, cheapestDentistId, responseCounts, type QuoteRow } from "@/lib/quotes";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { ExplainTreatment } from "@/components/request/explain-treatment";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { REQUEST_STATUS_LABELS_HE } from "@/lib/labels";

export const metadata = {
  title: "פרטי הבקשה",
};

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  if (!user) redirect("/sign-in");

  const request = await db.request.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      createdAt: true,
      treatmentFileUrl: true,
      xrayFileUrl: true,
      patientNotes: true,
      requestDentists: {
        select: {
          emailSent: true,
          sentAt: true,
          quote: { select: { amountMinor: true, currency: true, note: true } },
          dentist: {
            select: { id: true, dentistName: true, clinicName: true, city: true },
          },
        },
        orderBy: { dentist: { dentistName: "asc" } },
      },
    },
  });

  if (!request || request.userId !== user.id) notFound();

  const dentists = request.requestDentists;

  const quoteRows: QuoteRow[] = dentists.map((rd) => ({
    dentistId: rd.dentist.id,
    dentistName: rd.dentist.dentistName,
    clinicName: rd.dentist.clinicName,
    city: rd.dentist.city,
    amountMinor: rd.quote?.amountMinor ?? null,
    currency: rd.quote?.currency ?? null,
    note: rd.quote?.note ?? null,
  }));
  const sortedQuotes = sortByPrice(quoteRows);
  const cheapestId = cheapestDentistId(quoteRows);
  const { responded, total } = responseCounts(quoteRows);


  const date = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(request.createdAt);

  const isSent = request.status === "SENT" || request.status === "SUBMITTED";
  const filesReady = !!request.treatmentFileUrl && !!request.xrayFileUrl;

  // Where to continue an unfinished request (only relevant when not yet sent).
  const continueHref = !filesReady
    ? `/request/${id}/upload`
    : dentists.length === 0
      ? `/request/${id}/dentists`
      : `/request/${id}/confirm`;

  const fileLinks = [
    {
      icon: FileText,
      label: "תוכנית הטיפול",
      kind: "treatment",
      present: !!request.treatmentFileUrl,
    },
    { icon: ImageIcon, label: "צילום שיניים", kind: "xray", present: !!request.xrayFileUrl },
  ].filter((f) => f.present);

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-border/60 bg-muted/30 border-b py-12 lg:py-16">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              חזרה לאזור האישי
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
                בקשה #{request.id.slice(0, 8)}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
                  isSent
                    ? "bg-teal-deep/10 text-teal-deep"
                    : request.status === "FAILED"
                      ? "bg-coral/15 text-coral"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {isSent ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                {REQUEST_STATUS_LABELS_HE[request.status]}
              </span>
            </div>
            <p className="text-muted-foreground mt-3 text-sm">נוצרה ב-{date}</p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl space-y-8 px-6 py-10 lg:px-10 lg:py-14">
          {isSent && (
            <section>
              <div className="border-teal-deep/30 bg-teal-deep/5 text-foreground mb-4 flex items-center gap-2.5 rounded-2xl border px-5 py-4 text-sm">
                <Mail className="text-teal-deep h-4 w-4 shrink-0" />
                {responded > 0
                  ? `${responded} מתוך ${total} רופאים הגיבו. השוו את ההצעות למטה.`
                  : `הבקשה נשלחה ל-${total} רופאים. ההצעות יופיעו כאן ברגע שיגיבו.`}
              </div>

              {responded > 0 && (
                <ul className="border-border/60 bg-card divide-border/60 divide-y rounded-2xl border">
                  {sortedQuotes.map((q) => {
                    const isCheapest = q.dentistId === cheapestId;
                    return (
                      <li key={q.dentistId} className="flex items-start justify-between gap-4 p-4">
                        <div>
                          <p className="text-foreground font-semibold">
                            {q.dentistName}
                            {isCheapest && (
                              <span className="bg-teal-deep/10 text-teal-deep mr-2 rounded-full px-2 py-0.5 text-xs font-semibold">
                                המחיר הזול ביותר
                              </span>
                            )}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {q.clinicName} ✦ {q.city}
                          </p>
                          {q.note && (
                            <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
                              {q.note}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-left">
                          {q.amountMinor !== null ? (
                            <span className="text-foreground text-lg font-bold">
                              {formatMoney(q.amountMinor, q.currency ?? "ILS", "he")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">ממתין להצעה</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {!isSent && (
            <div className="border-border/60 bg-card flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-sm">
                {request.status === "FAILED"
                  ? "התשלום לא הושלם. ניתן לנסות שוב כדי לשלוח את הבקשה."
                  : "הבקשה עדיין לא נשלחה — השלימו את התהליך כדי לשלוח אותה לרופאים."}
              </p>
              <Link
                href={continueHref}
                className={cn(
                  buttonVariants(),
                  "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-6 font-semibold",
                )}
              >
                המשך הבקשה
              </Link>
            </div>
          )}

          {/* Files */}
          <section>
            <h2 className="font-display text-foreground mb-3 text-lg font-bold">המסמכים שהועלו</h2>
            {fileLinks.length === 0 ? (
              <p className="text-muted-foreground border-border/60 bg-card rounded-2xl border px-5 py-4 text-sm">
                עדיין לא הועלו מסמכים.
              </p>
            ) : (
              <ul className="border-border/60 bg-card divide-border/60 divide-y rounded-2xl border">
                {fileLinks.map((f) => (
                  <li key={f.label} className="flex items-center justify-between gap-3 p-4">
                    <span className="text-foreground inline-flex items-center gap-2.5 text-sm font-medium">
                      <f.icon className="text-teal-deep h-4 w-4" />
                      {f.label}
                    </span>
                    <a
                      href={`/api/files/${id}/${f.kind}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-deep text-sm font-semibold underline-offset-4 hover:underline"
                    >
                      צפייה בקובץ
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* AI: explain the treatment plan (on-demand) */}
          {request.treatmentFileUrl && <ExplainTreatment requestId={request.id} />}

          {/* Patient notes */}
          {request.patientNotes && (
            <section>
              <h2 className="font-display text-foreground mb-3 text-lg font-bold">הערות המטופל</h2>
              <p className="border-border/60 bg-card text-foreground rounded-2xl border px-5 py-4 text-sm whitespace-pre-wrap">
                {request.patientNotes}
              </p>
            </section>
          )}

          {/* Dentists */}
          <section>
            <h2 className="font-display text-foreground mb-3 inline-flex items-center gap-2 text-lg font-bold">
              <Users className="text-teal-deep h-5 w-5" />
              הרופאים בבקשה ({dentists.length})
            </h2>
            {dentists.length === 0 ? (
              <p className="text-muted-foreground border-border/60 bg-card rounded-2xl border px-5 py-4 text-sm">
                עדיין לא נבחרו רופאים.
              </p>
            ) : (
              <ul className="border-border/60 bg-card divide-border/60 divide-y rounded-2xl border">
                {dentists.map((rd) => (
                  <li key={rd.dentist.id} className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-foreground font-semibold">{rd.dentist.dentistName}</p>
                      <p className="text-muted-foreground text-xs">
                        {rd.dentist.clinicName} ✦ {rd.dentist.city}
                      </p>
                    </div>
                    {rd.emailSent && (
                      <span className="text-teal-deep inline-flex items-center gap-1 text-xs font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        נשלח
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
