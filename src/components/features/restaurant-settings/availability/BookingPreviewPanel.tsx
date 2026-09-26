'use client';

import { ChevronRight, Minus, Plus } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { TOUCH_TARGET_CLASS } from './AvailabilityFields';
import { MEAL_KEYS, MEAL_LABEL, formatOverrideDate } from './availabilityPageDraft';
import {
  formatTimeRanges,
  groupPreviewExclusions,
  previewAvailabilityDate,
  type AvailabilityPreviewSource,
} from './availabilityPreviewModel';
import { pluralise } from '../shared/settingsSaveSequence';

import type { OpsOccasion } from '@/services/ops/occasions';

const MIN_PARTY = 1;
const MAX_PARTY = 50;

type BookingPreviewPanelProps = {
  draftSource: AvailabilityPreviewSource;
  savedSource: AvailabilityPreviewSource;
  isDirty: boolean;
  today: string;
  occasions: readonly OpsOccasion[];
  /** Render without the card frame (inside the preview drawer). */
  bare?: boolean;
};

/**
 * What a guest could request on a date with these settings. A configuration preview: tables and
 * existing bookings are checked only when a guest books.
 */
export function BookingPreviewPanel({
  draftSource,
  savedSource,
  isDirty,
  today,
  occasions,
  bare = false,
}: BookingPreviewPanelProps) {
  const ids = useId();
  const [date, setDate] = useState(today);
  const [party, setParty] = useState(2);
  const [partyText, setPartyText] = useState('2');
  const [source, setSource] = useState<'draft' | 'saved'>('draft');
  const showSaved = isDirty && source === 'saved';

  const result = useMemo(
    () => previewAvailabilityDate(showSaved ? savedSource : draftSource, date, party),
    [date, draftSource, party, savedSource, showSaved],
  );
  const comparison = useMemo(
    () => (isDirty && !showSaved ? previewAvailabilityDate(savedSource, date, party) : null),
    [date, isDirty, party, savedSource, showSaved],
  );
  const exclusions = useMemo(() => groupPreviewExclusions(result, occasions), [occasions, result]);

  const setPartySize = (value: number) => {
    const next = Math.max(MIN_PARTY, Math.min(MAX_PARTY, value));
    setParty(next);
    setPartyText(String(next));
  };

  const dateLabel = formatOverrideDate(date, 'long');
  const special = draftSource.draft.overrideRows.find((row) => row.effectiveDate === date);
  const intervalLabel = result.hours.fixedSlotTimes
    ? 'fixed start times'
    : `every ${result.hours.intervalMinutes} min`;

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className={cn('flex flex-col', !bare && 'rounded-xl border border-border/70 bg-card')}
    >
      {bare ? null : (
        <div className="flex flex-col gap-1 border-b border-border/60 px-4 py-4">
          <h2 id={`${ids}-title`} className="text-base font-semibold leading-6">
            Booking preview
          </h2>
          <p className="text-xs text-muted-foreground">
            What a guest can request with these settings.
          </p>
        </div>
      )}
      {bare ? (
        <h2 id={`${ids}-title`} className="sr-only">
          Booking preview
        </h2>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-border/60 px-4 py-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${ids}-date`}>Date</Label>
          <Input
            id={`${ids}-date`}
            type="date"
            min={today}
            value={date}
            onChange={(event) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) {
                setDate(event.target.value);
              }
            }}
            className={TOUCH_TARGET_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-party`}>Party size</Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={TOUCH_TARGET_CLASS}
              aria-label="Fewer guests"
              onClick={() => setPartySize(party - 1)}
            >
              <Minus aria-hidden />
            </Button>
            <Input
              id={`${ids}-party`}
              inputMode="numeric"
              value={partyText}
              onChange={(event) => {
                setPartyText(event.target.value);
                const parsed = Number.parseInt(event.target.value, 10);
                if (parsed >= MIN_PARTY && parsed <= MAX_PARTY) {
                  setParty(parsed);
                }
              }}
              onBlur={() => setPartyText(String(party))}
              className={cn('w-14 text-center tabular-nums', TOUCH_TARGET_CLASS)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={TOUCH_TARGET_CLASS}
              aria-label="More guests"
              onClick={() => setPartySize(party + 1)}
            >
              <Plus aria-hidden />
            </Button>
          </div>
        </div>
        {isDirty ? (
          <div
            role="group"
            aria-label="Settings to preview"
            className="col-span-full grid grid-cols-2 gap-1 rounded-md border border-border/70 p-0.5"
          >
            {(['draft', 'saved'] as const).map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={source === value ? 'secondary' : 'ghost'}
                aria-pressed={source === value}
                onClick={() => setSource(value)}
                className={cn('font-medium', TOUCH_TARGET_CLASS)}
              >
                {value === 'draft' ? 'With your changes' : 'Saved settings'}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 px-4 py-4" aria-live="polite">
        {result.isClosed ? (
          <>
            <p className="font-semibold text-foreground">{dateLabel}</p>
            <p className="rounded-md bg-muted/60 px-3 py-2.5 text-sm">
              <span className="font-medium">Closed.</span>{' '}
              {special ? `Special date: ${special.notes || 'closure'}.` : 'Closed on this weekday.'}{' '}
              Guests can’t request any times.
            </p>
          </>
        ) : (
          <>
            <div>
              <p className="font-semibold text-foreground">{dateLabel}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                Open {result.hours.opensAt}–{result.hours.closesAt} · {intervalLabel}
                {special ? ` · special date: ${special.notes || 'different hours'}` : ''}
              </p>
            </div>
            {MEAL_KEYS.map((meal) => {
              const offered = result.offered.filter((slot) => slot.bookingOption === meal);
              const before = comparison?.offered
                .filter((slot) => slot.bookingOption === meal)
                .map((slot) => slot.value);
              const removed = before
                ? before.filter((value) => !offered.some((slot) => slot.value === value))
                : [];
              return (
                <div key={meal} className="flex flex-col gap-2">
                  <h3 className="flex justify-between gap-2 text-sm font-semibold">
                    <span>{MEAL_LABEL[meal]}</span>
                    <span className="font-normal text-muted-foreground tabular-nums">
                      {pluralise(offered.length, 'time')}
                      {offered[0] ? ` · ${offered[0].durationMinutes} min table` : ''}
                    </span>
                  </h3>
                  {offered.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {offered.map((slot) => {
                        const added = before ? !before.includes(slot.value) : false;
                        return (
                          <li
                            key={slot.value}
                            className={cn(
                              'rounded-md border px-2 py-0.5 font-mono text-xs tabular-nums',
                              added
                                ? 'border-dashed border-foreground font-semibold'
                                : 'border-border',
                            )}
                          >
                            {added ? (
                              <>
                                <span aria-hidden>+</span>
                                <span className="sr-only">New: </span>
                              </>
                            ) : null}
                            {slot.value}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No {MEAL_LABEL[meal].toLowerCase()} times on this date.
                    </p>
                  )}
                  {removed.length > 0 ? (
                    <>
                      <p className="text-xs">No longer offered:</p>
                      <ul className="flex flex-wrap gap-1.5">
                        {removed.map((value) => (
                          <li
                            key={value}
                            className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground line-through tabular-nums"
                          >
                            <span className="sr-only">Removed: </span>
                            {value}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              );
            })}
            {exclusions.length > 0 ? (
              <details className="group">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 py-1 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                    aria-hidden
                  />
                  Why other times aren’t offered ({result.excluded.length})
                </summary>
                <ul className="mt-2 flex flex-col gap-2.5 text-sm">
                  {exclusions.map((group) => (
                    <li key={group.key} className="flex flex-col gap-0.5">
                      <span className="font-medium">{group.title}</span>
                      <span className="font-mono text-xs tabular-nums">
                        {formatTimeRanges(group.times, result.hours.intervalMinutes)}
                      </span>
                      <span className="text-xs text-muted-foreground">{group.detail}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        )}
      </div>
      <p className="border-t border-border/60 bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          Configuration preview, not live availability.
        </span>{' '}
        Tables and existing bookings are checked when a guest books, so a time shown here can still
        be full.
      </p>
    </section>
  );
}
