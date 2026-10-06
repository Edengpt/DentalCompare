import { FileLock2, Scale, ShieldCheck, Undo2 } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * Four answers to "but can I trust this?", each one true of the system as it
 * stands: licence checks gate the directory, the quote form asks for the
 * warranty, revenue is a flat clinic subscription, and medical files sit in
 * private storage. No numbers, no reviews — there are none to show yet.
 */
export function Trust({ t }: { t: Dictionary["trust"] }) {
  const cards = [
    { Icon: ShieldCheck, title: t.checkedTitle, body: t.checkedBody },
    { Icon: Undo2, title: t.warrantyTitle, body: t.warrantyBody },
    { Icon: Scale, title: t.neutralTitle, body: t.neutralBody },
    { Icon: FileLock2, title: t.filesTitle, body: t.filesBody },
  ];

  return (
    <section className="py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <h2 className="font-display text-foreground text-2xl font-bold sm:text-3xl">{t.title}</h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t.subtitle}</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ Icon, title, body }) => (
            <li key={title} className="border-border bg-card rounded-lg border p-5">
              <span className="bg-coral-soft text-teal-deep grid h-10 w-10 place-items-center rounded-md">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="font-display text-foreground mt-4 text-base font-bold">{title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
