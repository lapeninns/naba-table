'use client';

import { X } from 'lucide-react';

import { OpsStatusBadge } from '@/components/features/ops-shell/patterns/OpsStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { toMs } from './domain/timeSelection';
import { SERVICE_STATE_META } from './domain/types';
import { formatClock } from './format';
import { serviceTone } from './serviceStateStyles';
import { FLOOR_FOCUS_RING } from './styles';

import type { JoinGroup } from './domain/joins';
import type { FloorPlanNode } from './useFloorPlanState';

const SEAT_LABEL: Record<string, string> = {
  standard: 'Standard',
  sofa: 'Sofa',
  booth: 'Booth',
  high_top: 'High-top',
};

export type TableDetailViewProps = {
  node: FloorPlanNode;
  joinGroup: JoinGroup | null;
  joinTargets: { id: string; label: string }[];
  timezone: string;
  isSeating: boolean;
  isClearing: boolean;
  onClose: () => void;
  onSeatParty: (bookingId: string) => void;
  onClearTable: (bookingId: string) => void;
  onMarkNoShow: (bookingId: string) => void;
  onSplit: (bookingId: string, tableId: string) => void;
  onJoin: (bookingId: string, tableIds: string[]) => void;
};

/** Detail for the selected table: status, attributes, guest, combine/split, seat/clear actions. */
export function TableDetailView({
  node,
  joinGroup,
  joinTargets,
  timezone,
  isSeating,
  isClearing,
  onClose,
  onSeatParty,
  onClearTable,
  onMarkNoShow,
  onSplit,
  onJoin,
}: TableDetailViewProps) {
  const { table, resolved } = node;
  const booking = resolved.booking;
  const meta = SERVICE_STATE_META[resolved.state];
  const occupiedNow = booking?.status === 'checked_in';
  const startMs = toMs(booking?.startAt);
  const isOverdue = resolved.state === 'overdue';

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {table.zoneName ?? 'Zone'}
          </div>
          <div className="mt-1 flex items-baseline gap-2.5">
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {table.tableNumber}
            </span>
            <span className="text-sm text-muted-foreground">{table.capacity} seats</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          onClick={onClose}
          aria-label="Close detail"
          className={cn('shrink-0 text-muted-foreground', FLOOR_FOCUS_RING)}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className={cn('w-fit', isOverdue && 'motion-safe:animate-pulse')}>
        <OpsStatusBadge label={meta.label} tone={serviceTone(resolved.state)} />
      </div>

      <Separator />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="font-medium">
          {SEAT_LABEL[table.seatingType] ?? table.seatingType}
        </Badge>
        <Badge variant="secondary" className="font-medium">
          {table.mobility === 'movable' ? 'Movable' : 'Fixed'}
        </Badge>
        {table.section ? (
          <Badge variant="secondary" className="font-medium">
            {table.section}
          </Badge>
        ) : null}
      </div>

      {booking ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
          <div className="text-sm font-semibold text-foreground">
            {booking.customerName ?? 'Guest'}
          </div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {booking.partySize} covers
            {startMs !== null ? ` · ${formatClock(startMs, timezone)}` : ''}
          </div>
        </div>
      ) : null}

      {joinGroup ? (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
          <div className="break-words text-xs uppercase tracking-wide text-primary">
            Joined · {joinGroup.tableIds.join(' + ')} · {joinGroup.capacity} seats
          </div>
          {booking ? (
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 self-start px-2.5', FLOOR_FOCUS_RING)}
              onClick={() => onSplit(booking.id, table.id)}
            >
              Split tables
            </Button>
          ) : null}
        </div>
      ) : null}

      {booking && joinTargets.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Combine with</div>
          <div className="flex flex-wrap gap-1.5">
            {joinTargets.map((target) => (
              <Button
                key={target.id}
                variant="outline"
                size="sm"
                className={cn('h-8', FLOOR_FOCUS_RING)}
                onClick={() => onJoin(booking.id, [target.id])}
              >
                {target.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {booking && occupiedNow ? (
          <Button
            onClick={() => onClearTable(booking.id)}
            disabled={isClearing}
            className={cn('w-full', FLOOR_FOCUS_RING)}
          >
            Clear table
          </Button>
        ) : null}
        {booking && !occupiedNow && isOverdue ? (
          <>
            <Button
              variant="destructive"
              onClick={() => onMarkNoShow(booking.id)}
              className={cn('w-full', FLOOR_FOCUS_RING)}
            >
              Mark no-show
            </Button>
            <Button
              variant="outline"
              onClick={() => onClearTable(booking.id)}
              disabled={isClearing}
              className={cn('w-full', FLOOR_FOCUS_RING)}
            >
              Clear
            </Button>
          </>
        ) : null}
        {booking && !occupiedNow && !isOverdue ? (
          <Button
            onClick={() => onSeatParty(booking.id)}
            disabled={isSeating}
            className={cn('w-full', FLOOR_FOCUS_RING)}
          >
            Seat party
          </Button>
        ) : null}
        {!booking ? (
          <p className="text-center text-sm text-muted-foreground">
            No booking on this table right now.
          </p>
        ) : null}
      </div>
    </div>
  );
}
