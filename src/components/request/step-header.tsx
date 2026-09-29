import { cn } from "@/lib/utils";

/** How many steps the request flow has: upload, travel, clinics, confirm. */
export const REQUEST_STEPS = 4;

/**
 * The header of each step of the request flow.
 *
 * On a phone it used to take most of the first screen — a 36px title and a
 * paragraph before the patient could see the thing they came to do. It is
 * compact there now, with a progress bar that says how far along they are at
 * a glance; from sm up it keeps its roomier proportions.
 */
export function StepHeader({
  step,
  label,
  title,
  subtitle,
  wide = false,
  children,
}: {
  /** 1-based. */
  step: number;
  /** The "Step 2 of 4" text, already worded. */
  label: string;
  title: string;
  subtitle: string;
  /** Match the directory's wider content column. */
  wide?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-border/60 bg-muted/30 border-b py-6 sm:py-12 lg:py-16">
      <div className={cn("mx-auto px-6 lg:px-10", wide ? "max-w-7xl" : "max-w-3xl")}>
        <div
          className="flex max-w-xs gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={REQUEST_STEPS}
          aria-valuenow={step}
          aria-label={label}
        >
          {Array.from({ length: REQUEST_STEPS }, (_, i) => (
            <span
              key={i}
              className={cn("h-1.5 flex-1 rounded-full", i < step ? "bg-teal" : "bg-border")}
            />
          ))}
        </div>
        <p className="text-muted-foreground mt-2 text-xs font-medium">{label}</p>
        <h1 className="font-display text-foreground mt-3 text-2xl leading-tight font-bold tracking-tight text-balance sm:mt-4 sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm text-pretty sm:mt-4 sm:text-lg">
          {subtitle}
        </p>
        {children}
      </div>
    </section>
  );
}
