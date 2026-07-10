import "server-only";

type Level = "info" | "warn" | "error";

/**
 * Minimal structured logger (Step 12 — the no-new-dependency observability
 * option). Emits one JSON line per event so Vercel log drains / alerts can
 * filter and aggregate on `event` and the structured fields, instead of grepping
 * free-form console strings. Swap the sink for Sentry here if a provider is later
 * approved — call sites stay unchanged.
 */
export function logEvent(
  level: Level,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({ level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
