'use client';

import { useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBookingHistory } from '@/hooks/useBookingHistory';
import { cn } from '@/lib/utils';
import { formatBookingLabel, formatReservationDate, formatReservationTime } from '@reserve/shared/formatting/booking';
import { normalizeTime } from '@reserve/shared/time';

import type { BookingHistoryChange } from '@/types/bookingHistory';

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  pending: 'Pending',
  pending_allocation: 'Pending allocation',
};

const SEATING_LABELS: Record<string, string> = {
  any: 'No preference',
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  window: 'Window',
  booth: 'Booth',
  bar: 'Bar',
};

function formatChangeValue(change: BookingHistoryChange): string {
  const { field, after } = change;

  if (after === null || after === undefined) {
    return '—';
  }

  if (field === 'booking_date' && typeof after === 'string') {
    return formatReservationDate(after);
  }

  if ((field === 'start_time' || field === 'end_time') && typeof after === 'string') {
    return formatReservationTime(normalizeTime(after) ?? after);
  }

  if (field === 'party_size') {
    return String(after);
  }

  if (field === 'booking_type' && typeof after === 'string') {
    return formatBookingLabel(after as Parameters<typeof formatBookingLabel>[0]);
  }

  if (field === 'seating_preference' && typeof after === 'string') {
    return SEATING_LABELS[after] ?? after;
  }

  if (field === 'status' && typeof after === 'string') {
    return STATUS_LABELS[after] ?? after;
  }

  if (typeof after === 'boolean') {
    return after ? 'Yes' : 'No';
  }

  if (typeof after === 'string') {
    return after;
  }

  return String(after);
}

function formatBeforeValue(change: BookingHistoryChange): string {
  const { field, before } = change;

  if (before === null || before === undefined) {
    return '—';
  }

  if (field === 'booking_date' && typeof before === 'string') {
    return formatReservationDate(before);
  }

  if ((field === 'start_time' || field === 'end_time') && typeof before === 'string') {
    return formatReservationTime(normalizeTime(before) ?? before);
  }

  if (field === 'party_size') {
    return String(before);
  }

  if (field === 'booking_type' && typeof before === 'string') {
    return formatBookingLabel(before as Parameters<typeof formatBookingLabel>[0]);
  }

  if (field === 'seating_preference' && typeof before === 'string') {
    return SEATING_LABELS[before] ?? before;
  }

  if (field === 'status' && typeof before === 'string') {
    return STATUS_LABELS[before] ?? before;
  }

  if (typeof before === 'boolean') {
    return before ? 'Yes' : 'No';
  }

  if (typeof before === 'string') {
    return before;
  }

  return String(before);
}

export function ReservationHistory({ reservationId }: { reservationId: string }) {
  const historyQuery = useBookingHistory(reservationId);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [],
  );

  if (historyQuery.isLoading) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-sm">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">History</h2>
          <p className="text-sm text-muted-foreground">Loading recent changes…</p>
        </header>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="h-20 w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (historyQuery.isError) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-sm">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">History</h2>
          <p className="text-sm text-muted-foreground">Review how this reservation changed over time.</p>
        </header>
        <Alert variant="destructive">
          <AlertTitle>Unable to load history</AlertTitle>
          <AlertDescription>{historyQuery.error?.message ?? 'Please try again later.'}</AlertDescription>
        </Alert>
      </section>
    );
  }

  const events = historyQuery.data?.events ?? [];

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-sm">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">History</h2>
        <p className="text-sm text-muted-foreground">Track edits and cancellations for this reservation.</p>
      </header>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
      ) : (
        <ul className="space-y-4">
          {events.map((event) => {
            const actorLabel = event.actor && event.actor.trim().length > 0 ? event.actor.trim() : 'system';
            const actorDisplay = actorLabel.toLowerCase() === 'system' ? 'System' : actorLabel;

            return (
              <li key={event.versionId} className="space-y-3 rounded-lg border border-border/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{event.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatter.format(new Date(event.changedAt))}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs font-medium">
                    {actorDisplay}
                  </Badge>
                </div>

                {event.changes.length > 0 ? (
                  <dl className="space-y-2">
                    {event.changes.map((change) => (
                      <div key={`${event.versionId}-${change.field}`} className="grid gap-3 sm:grid-cols-[180px,1fr]">
                        <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {change.label}
                        </dt>
                        <dd className="text-sm text-foreground">
                          <span
                            className={cn(
                              'inline-flex flex-wrap items-center gap-1',
                              'rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground',
                            )}
                          >
                            <span>{formatBeforeValue(change)}</span>
                            <span aria-hidden>→</span>
                            <span className="text-foreground">{formatChangeValue(change)}</span>
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">No notable field changes recorded.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
