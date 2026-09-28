"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";
import { format } from "@/i18n/format";
import { toggleCountryActive } from "@/server/country-actions";
import { cn } from "@/lib/utils";

export function ToggleCountry({
  code,
  name,
  isActive,
}: {
  code: string;
  name: string;
  isActive: boolean;
}) {
  const t = useT();
  const [isProcessing, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await toggleCountryActive(code);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        format(isActive ? t.admin.countryDeactivated : t.admin.countryActivated, { country: name }),
      );
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isProcessing}
      title={isActive ? t.admin.toggleToDisable : t.admin.toggleToEnable}
      className={cn(
        "rounded-sm px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
        isActive
          ? "bg-teal-deep/10 text-teal-deep hover:bg-teal-deep/20"
          : "bg-highlight/40 text-on-highlight hover:bg-highlight/60",
      )}
    >
      {isActive ? t.admin.statusActive : t.admin.countryDraft}
    </button>
  );
}
