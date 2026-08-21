import { Building2, Mail, Phone, MapPin, Clock, FileSignature, User } from "lucide-react";
import { requireAdmin } from "@/server/admin";
import { db } from "@/lib/db";
import { translateSpecialty, translateInsurer, translateTreatment } from "@/lib/labels";
import { ClinicReviewActions } from "@/components/admin/clinic-review-actions";

export const metadata = { title: "ניהול — הרשמות מרפאות" };
export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminClinicsPage() {
  await requireAdmin();

  const pending = await db.dentist.findMany({
    where: { submittedBySelf: true, isActive: false },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
          הרשמות מרפאות
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          מרפאות שנרשמו עצמאית וממתינות לאישור. בדקו את הפרטים ואת אישור החוזה, ואשרו לפרסום במאגר —
          או דחו את ההרשמה.
        </p>
      </header>

      {pending.length === 0 ? (
        <div className="border-border/60 bg-card rounded-2xl border px-6 py-16 text-center">
          <div className="bg-teal-deep/10 text-teal-deep mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full">
            <Building2 className="h-7 w-7" />
          </div>
          <p className="text-foreground mt-5 text-lg font-semibold">אין הרשמות שממתינות לאישור</p>
          <p className="text-muted-foreground mt-1.5 text-sm">
            כל ההרשמות החדשות של מרפאות יופיעו כאן לבדיקה ואישור.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="border-coral/40 bg-coral/5 text-foreground rounded-2xl border px-5 py-3 text-sm">
            <strong className="font-semibold">{pending.length}</strong> הרשמות ממתינות לאישור.
          </div>

          {pending.map((d) => (
            <article
              key={d.id}
              className="border-border/60 bg-card overflow-hidden rounded-3xl border"
            >
              <div className="border-border/60 flex flex-wrap items-start justify-between gap-4 border-b p-6">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="bg-teal-deep/10 text-teal-deep inline-flex h-11 w-11 items-center justify-center rounded-xl">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-display text-foreground text-xl font-bold">
                        {d.clinicName}
                      </h2>
                      <p className="text-muted-foreground text-sm">{d.dentistName}</p>
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  נרשמה {dateFmt.format(d.createdAt)}
                </p>
              </div>

              <div className="grid gap-x-8 gap-y-4 p-6 sm:grid-cols-2">
                <Detail icon={User} label="איש קשר" value={d.contactName ?? "—"} />
                <Detail icon={Mail} label="אימייל" value={d.email} />
                <Detail icon={Phone} label="טלפון" value={d.phone} />
                <Detail
                  icon={MapPin}
                  label="כתובת"
                  value={`${d.address}${d.city ? `, ${d.city}` : ""}`}
                />
                <Detail icon={Clock} label="שנות ניסיון" value={`${d.experienceYears} שנים`} />
                <Detail
                  icon={Building2}
                  label="התמחויות"
                  value={d.specialties.map(translateSpecialty).join(", ") || "—"}
                />
                <Detail
                  icon={Building2}
                  label="טיפולים"
                  value={d.treatments.map(translateTreatment).join(", ") || "—"}
                />
                <Detail
                  icon={Building2}
                  label="קופות חולים"
                  value={d.insurerAffiliations.map(translateInsurer).join(", ") || "—"}
                />
              </div>

              <div className="border-border/60 flex flex-wrap items-center justify-between gap-4 border-t px-6 py-4">
                <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                  <FileSignature className="text-teal-deep h-4 w-4" />
                  {d.agreedToTermsAt ? (
                    <>
                      חתמה על חוזה העמלה (גרסה {d.termsVersion ?? "—"}) ב-
                      {dateFmt.format(d.agreedToTermsAt)}
                    </>
                  ) : (
                    <span className="text-coral">לא נרשם אישור חוזה</span>
                  )}
                </p>
                <ClinicReviewActions dentistId={d.id} clinicName={d.clinicName} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="text-muted-foreground/70 mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-foreground text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
