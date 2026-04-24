'use client';

import { InlineAlert } from '@/components/features/booking/ui/BookingComponents';
import { GuestPanel, GuestPanelHeader } from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBookingHistory } from '@/hooks/useBookingHistory';
import { cn } from '@/lib/utils';
import {
  formatBookingLabel,
  formatReservationDate,
  formatReservationDateTimeFromDate,
  formatReservationTime,
} from '@reserve/shared/formatting/booking';
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

export function ReservationHistory({
  reservationId,
  timezone,
}: {
  reservationId: string;
  timezone: string;
}) {
  const historyQuery = useBookingHistory(reservationId);

  if (historyQuery.isLoading) {
    return (
      <GuestPanel className="overflow-hidden">
        <GuestPanelHeader title="History" description="Loading recent changes…" />
        <div className="space-y-3 px-5 py-5 sm:px-6">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="h-20 w-full" />
          ))}
        </div>
      </GuestPanel>
    );
  }

  if (historyQuery.isError) {
    return (
      <GuestPanel className="overflow-hidden">
        <GuestPanelHeader
          title="History"
          description="Review how this reservation changed over time."
        />
        <div className="px-5 py-5 sm:px-6">
          <InlineAlert tone="danger">
            Unable to load history. {historyQuery.error?.message ?? 'Please try again later.'}
          </InlineAlert>
        </div>
      </GuestPanel>
    );
  }

  const events = historyQuery.data?.events ?? [];

  return (
    <GuestPanel className="overflow-hidden">
      <GuestPanelHeader
        title="History"
        description="Track edits and cancellations for this reservation."
      />
      <div className="px-5 py-5 sm:px-6">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
        ) : (
          <ul className="space-y-4">
            {events.map((event) => {
              const actorLabel =
                event.actor && event.actor.trim().length > 0 ? event.actor.trim() : 'system';
              const actorDisplay = actorLabel.toLowerCase() === 'system' ? 'System' : actorLabel;
              const changedAtLabel =
                formatReservationDateTimeFromDate(new Date(event.changedAt), { timezone }) || '—';

              return (
                <li
                  key={event.versionId}
                  className="space-y-3 rounded-[var(--pg-radius-md)] border border-border/70 bg-background/80 p-4 shadow-[var(--pg-shadow-xs)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{event.summary}</p>
                      <p className="text-xs text-muted-foreground">{changedAtLabel}</p>
                    </div>
                    <Badge variant="outline" className="text-xs font-medium">
                      {actorDisplay}
                    </Badge>
                  </div>

                  {event.changes.length > 0 ? (
                    <dl className="space-y-2">
                      {event.changes.map((change) => (
                        <div
                          key={`${event.versionId}-${change.field}`}
                          className="grid gap-3 sm:grid-cols-[180px,1fr]"
                        >
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
                    <p className="text-sm text-muted-foreground">
                      No notable field changes recorded.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </GuestPanel>
  );
}
