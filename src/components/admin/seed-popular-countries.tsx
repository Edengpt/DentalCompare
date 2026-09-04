"use client";

import { useTransition } from "react";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { seedPopularCountries } from "@/server/country-actions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function SeedPopularCountries() {
  const t = useT();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await seedPopularCountries();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        format(t.admin.seedPopularCountriesDone, {
          created: result.created.length,
          activated: result.activated.length,
        }),
      );
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={t.admin.seedPopularCountriesHint}
      className={cn(
        buttonVariants(),
        "border-teal-deep/30 text-teal-deep hover:bg-teal-deep/10 inline-flex h-10 items-center gap-2 rounded-full border bg-transparent px-5 text-sm font-semibold disabled:opacity-60",
      )}
    >
      <Globe className="h-4 w-4" />
      {t.admin.seedPopularCountries}
    </button>
  );
}
