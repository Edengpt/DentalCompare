"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Loader2, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { normalizePhone, formatPhoneForDisplay, FALLBACK_PHONE_COUNTRY } from "@/lib/phone";
import { syncVerifiedPhone } from "@/server/phone-actions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type Step = "enter" | "code";

/**
 * SMS verification of the patient's mobile, using Clerk's own phone-number
 * primitives — Clerk sends and checks the OTP, so there's no separate SMS
 * provider, no code storage of our own, and no bespoke brute-force handling.
 *
 * This is a quality gate, not a payment step (PRD 4.2): it exists so clinics
 * paying a subscription receive reachable people rather than junk. The gate is
 * also enforced server-side in submitRequest — this screen is the UI for it, not
 * the enforcement.
 */
export function PhoneVerification({ redirectTo }: { redirectTo: string }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [step, setStep] = useState<Step>("enter");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [isSyncing, startSync] = useTransition();

  // Clerk's PhoneNumber resource for the number being verified, kept across the
  // two steps so attemptVerification runs against the same resource.
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (!isLoaded) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        טוען…
      </div>
    );
  }

  const sendCode = async () => {
    // The field takes a local spelling (050-555-5555), which needs a country to
    // be readable at all — without one the parser returns null for every input.
    const e164 = normalizePhone(phone, FALLBACK_PHONE_COUNTRY);
    if (!e164) {
      toast.error("מספר לא תקין — הזינו מספר נייד ישראלי, למשל 050-123-4567");
      return;
    }
    setBusy(true);
    try {
      // Reuse an existing unverified entry for the same number instead of
      // creating a duplicate every time the user retries.
      const existing = user?.phoneNumbers.find((p) => p.phoneNumber === e164);
      const resource = existing ?? (await user!.createPhoneNumber({ phoneNumber: e164 }));
      await resource.prepareVerification();
      setPendingId(resource.id);
      setStep("code");
      toast.success(`שלחנו קוד בן 6 ספרות ל-${formatPhoneForDisplay(e164)}`);
    } catch (err) {
      toast.error(clerkMessage(err, "לא הצלחנו לשלוח את הקוד — בדקו את המספר ונסו שוב"));
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    if (code.trim().length !== 6) {
      toast.error("הקוד מורכב מ-6 ספרות");
      return;
    }
    setBusy(true);
    try {
      const resource = user!.phoneNumbers.find((p) => p.id === pendingId);
      if (!resource) throw new Error("missing phone resource");

      await resource.attemptVerification({ code: code.trim() });
      // Make it the primary number so the server reads the one just verified.
      await user!.update({ primaryPhoneNumberId: resource.id });
      await user!.reload();

      // Mirror Clerk's verdict into our DB now rather than waiting for the
      // webhook, which may not reach a local dev machine at all.
      startSync(async () => {
        const result = await syncVerifiedPhone();
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("המספר אומת ✓");
        router.push(redirectTo);
        router.refresh();
      });
    } catch (err) {
      toast.error(clerkMessage(err, "הקוד שגוי או פג תוקף — בקשו קוד חדש"));
    } finally {
      setBusy(false);
    }
  };

  const pending = busy || isSyncing;

  return (
    <div className="border-border/60 bg-card space-y-5 rounded-3xl border p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="bg-teal-deep/10 text-teal-deep inline-flex h-10 w-10 items-center justify-center rounded-xl">
          {step === "enter" ? <Phone className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </span>
        <div>
          <p className="text-foreground font-semibold">
            {step === "enter" ? "אימות מספר נייד" : "הזינו את הקוד שקיבלתם"}
          </p>
          <p className="text-muted-foreground text-sm">
            {step === "enter"
              ? "המרפאות חוזרות אליכם בטלפון, ולכן אנחנו מוודאים שהמספר נכון."
              : `שלחנו קוד בן 6 ספרות ל-${formatPhoneForDisplay(normalizePhone(phone, FALLBACK_PHONE_COUNTRY))}`}
          </p>
        </div>
      </div>

      {step === "enter" ? (
        <>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder="050-123-4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !pending && sendCode()}
            className="border-border/60 bg-background focus:ring-teal-deep/40 w-full rounded-2xl border px-4 py-3 text-base outline-none focus:ring-2"
            aria-label="מספר נייד"
          />
          <button
            type="button"
            onClick={sendCode}
            disabled={pending}
            className={cn(
              buttonVariants(),
              "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-semibold",
              pending && "cursor-wait opacity-80",
            )}
          >
            {busy ? (
              <>
                שולחים קוד…
                <Loader2 className="h-4 w-4 animate-spin" />
              </>
            ) : (
              "שליחת קוד ב-SMS"
            )}
          </button>
        </>
      ) : (
        <>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            dir="ltr"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && !pending && confirmCode()}
            className="border-border/60 bg-background focus:ring-teal-deep/40 w-full rounded-2xl border px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none focus:ring-2"
            aria-label="קוד אימות"
          />
          <button
            type="button"
            onClick={confirmCode}
            disabled={pending}
            className={cn(
              buttonVariants(),
              "bg-teal-deep hover:bg-teal-deep/90 text-cream inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-semibold",
              pending && "cursor-wait opacity-80",
            )}
          >
            {pending ? (
              <>
                מאמתים…
                <Loader2 className="h-4 w-4 animate-spin" />
              </>
            ) : (
              "אישור הקוד"
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("enter");
              setCode("");
            }}
            disabled={pending}
            className="text-muted-foreground hover:text-foreground w-full text-sm underline-offset-4 hover:underline"
          >
            הזנתי מספר שגוי — חזרה
          </button>
        </>
      )}
    </div>
  );
}

/** Clerk surfaces user-facing reasons in errors[0].longMessage; fall back if absent. */
function clerkMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "errors" in err) {
    const first = (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors?.[0];
    return first?.longMessage ?? first?.message ?? fallback;
  }
  return fallback;
}
