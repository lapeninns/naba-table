'use client';

import { ChevronRight, Clock, MapPin, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { formatTime, STATUS_META, type SelectedSegment } from './tableTimelineDomain';

export function TableTimelineSegmentDialog({
  selected,
  onClose,
  onReleaseHold,
  actionState,
}: {
  selected: SelectedSegment | null;
  onClose: () => void;
  onReleaseHold: (holdId: string, bookingId: string | null) => void;
  actionState: { releasing: boolean; error: string | null };
}) {
  if (!selected) return null;

  const { table, segment } = selected;
  const start = formatTime(segment.start);
  const end = formatTime(segment.end);
  const durationMinutes = Math.max(
    Math.round((new Date(segment.end).getTime() - new Date(segment.start).getTime()) / 60000),
    0,
  );
  const holdId = segment.hold?.id ?? null;
  const bookingId = segment.hold?.bookingId ?? segment.booking?.id ?? null;
  const meta = STATUS_META[segment.state];

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-lg font-semibold text-foreground">
              T{table.tableNumber}
            </div>
            <div className="space-y-1 text-left">
              <DialogTitle>Table {table.tableNumber}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                {start} – {end}
                {durationMinutes ? ` (${durationMinutes}m)` : ''}
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{table.zoneName ?? 'No zone'}</span>
            <span className="text-border">•</span>
            <Users className="h-4 w-4" />
            <span>{table.capacity} seats</span>
          </div>
        </DialogHeader>

        <div className={cn('rounded-xl border p-4', meta.bg, meta.border)}>
          <div className="flex items-start gap-3">
            <Badge className={cn('flex-shrink-0', meta.chip)}>{meta.label}</Badge>
            <div className="space-y-1 text-sm">
              {segment.booking ? (
                <>
                  <p className="font-semibold text-foreground">
                    {segment.booking.customerName ?? 'Guest'}
                  </p>
                  <p className="text-muted-foreground">
                    Party of {segment.booking.partySize} · {segment.booking.status}
                  </p>
                </>
              ) : segment.state === 'hold' ? (
                <>
                  <p className="font-semibold text-foreground">Table is on hold</p>
                  <p className="text-muted-foreground">
                    Linked booking ID: {bookingId ?? 'unknown'}
                  </p>
                </>
              ) : segment.state === 'out_of_service' ? (
                <>
                  <p className="font-semibold text-foreground">Out of service</p>
                  <p className="text-muted-foreground">Temporarily unavailable</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-foreground">Available slot</p>
                  <p className="text-muted-foreground">Ready to be assigned</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {segment.booking ? (
            <Button asChild className="flex-1">
              <a href={`/bookings?query=${encodeURIComponent(segment.booking.customerName ?? '')}`}>
                View booking
                <ChevronRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          ) : null}
          {segment.state === 'hold' ? (
            <Button
              className="flex-1"
              variant="outline"
              disabled={!holdId || !bookingId || actionState.releasing}
              onClick={() => holdId && onReleaseHold(holdId, bookingId)}
            >
              {actionState.releasing ? 'Releasing hold…' : 'Release hold'}
            </Button>
          ) : null}
          {segment.state === 'available' ? (
            <Button className="flex-1" variant="secondary" disabled>
              Create booking
            </Button>
          ) : null}
        </div>
        {actionState.error ? <p className="text-xs text-destructive">{actionState.error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
