/**
 * The quote form's pill toggle — used for inclusions, the treatment picker and
 * travel choices, so every "click to choose" in the form looks and reads the
 * same.
 */
export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "border-teal-deep bg-teal-deep text-cream rounded-full border px-3.5 py-1.5 text-sm font-medium"
          : "border-border/60 text-muted-foreground hover:border-teal-deep/50 rounded-full border px-3.5 py-1.5 text-sm"
      }
    >
      {children}
    </button>
  );
}

export const fieldClass =
  "border-border/60 focus:border-teal-deep w-full rounded-lg border px-4 py-3 outline-none";
