"use client";

import { useT } from "@/i18n/provider";
import { QUOTE_LIMITS, QUOTE_TRANSFERS } from "@/lib/quote-catalog";
import { translateTransfer } from "@/lib/labels";
import { Chip, fieldClass } from "./chip";

/**
 * What the final price covers beyond the treatment: flights, accommodation,
 * ground transfers. No prices of their own — they are inside the total — but
 * they are what makes two cross-border quotes comparable.
 *
 * Flights have no default: a clinic that skips the question would otherwise
 * be telling the patient "not included" without having said so.
 */
export function TravelFields({
  flightsIncluded,
  onFlightsIncluded,
  flightTickets,
  onFlightTickets,
  lodging,
  onLodging,
  nights,
  onNights,
  transfers,
  onToggleTransfer,
}: {
  flightsIncluded: boolean | null;
  onFlightsIncluded: (v: boolean) => void;
  flightTickets: string;
  onFlightTickets: (v: string) => void;
  lodging: boolean;
  onLodging: (v: boolean) => void;
  nights: string;
  onNights: (v: string) => void;
  transfers: string[];
  onToggleTransfer: (key: string) => void;
}) {
  const t = useT();
  const q = t.quoteForm;

  return (
    <fieldset className="space-y-4">
      <legend className="text-foreground mb-1 text-sm font-semibold">{q.travelLegend}</legend>
      <p className="text-muted-foreground -mt-2 text-xs">{q.travelHint}</p>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">{q.flightsQuestion}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={flightsIncluded === true} onClick={() => onFlightsIncluded(true)}>
            {q.yes}
          </Chip>
          <Chip active={flightsIncluded === false} onClick={() => onFlightsIncluded(false)}>
            {q.no}
          </Chip>
        </div>
        {flightsIncluded && (
          <label className="mt-3 flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">{q.flightTickets}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={QUOTE_LIMITS.maxFlightTickets}
              value={flightTickets}
              onChange={(e) => onFlightTickets(e.target.value)}
              className={fieldClass}
            />
          </label>
        )}
      </div>

      <div>
        <Chip active={lodging} onClick={() => onLodging(!lodging)}>
          {q.lodgingIncluded}
        </Chip>
        {lodging && (
          <label className="mt-3 flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">{q.accommodationNights}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              value={nights}
              onChange={(e) => onNights(e.target.value)}
              className={fieldClass}
              placeholder={q.accommodationNightsPlaceholder}
            />
          </label>
        )}
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">{q.transfersLegend}</p>
        <div className="flex flex-wrap gap-2">
          {QUOTE_TRANSFERS.map((key) => (
            <Chip key={key} active={transfers.includes(key)} onClick={() => onToggleTransfer(key)}>
              {translateTransfer(t.labels, key)}
            </Chip>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
