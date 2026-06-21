'use client';

import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { toMs } from './domain/timeSelection';
import { SERVICE_STATE_META } from './domain/types';
import { formatClock } from './format';
import { StatusDot } from './StatusDot';

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
  timezone: string;
  isSeating: boolean;
  isClearing: boolean;
  canSplit: boolean;
  onClose: () => void;
  onSeatParty: (bookingId: string) => void;
  onClearTable: (bookingId: string) => void;
  onMarkNoShow: (bookingId: string) => void;
  onSplit: (bookingId: string, tableId: string) => void;
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

/** Detail for the selected table: state, badges, guest, combine info, seat/clear actions. */
export function TableDetailView({
  node,
  joinGroup,
  timezone,
  isSeating,
  isClearing,
  canSplit,
  onClose,
  onSeatParty,
  onClearTable,
  onMarkNoShow,
  onSplit,
}: TableDetailViewProps) {
  const { table, resolved } = node;
  const booking = resolved.booking;
  const meta = SERVICE_STATE_META[resolved.state];
  const occupiedNow = booking?.status === 'checked_in';
  const startMs = toMs(booking?.startAt);

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {table.zoneName ?? 'Zone'}
          </div>
          <div className="mt-1.5 flex items-baseline gap-2.5">
            <span className="font-mono text-3xl font-semibold leading-none tabular-nums text-foreground">
              {table.tableNumber}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{table.capacity} seats</span>
          </div>
        </div>
        <Button
          variant="ghost"
          type="button"
          onClick={onClose}
          aria-label="Close detail"
          className="flex size-7 flex-none items-center justify-center rounded-md border border-border p-0 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </Button>
      </div>

      <StatusDot label={meta.label} tone={meta.tone} pulse={resolved.state === 'overdue'} />

      <div className="h-px bg-border" />

      <div className="flex flex-wrap gap-1.5">
        <Chip>{SEAT_LABEL[table.seatingType] ?? table.seatingType}</Chip>
        <Chip>{table.mobility === 'movable' ? 'Movable' : 'Fixed'}</Chip>
        {table.section ? <Chip>{table.section}</Chip> : null}
      </div>

      {booking ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-2.5">
          <div className="text-sm font-semibold text-foreground">
            {booking.customerName ?? 'Guest'}
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
            {booking.partySize} covers{startMs !== null ? ` · ${formatClock(startMs, timezone)}` : ''}
          </div>
        </div>
      ) : null}

      {joinGroup ? (
        <div className="flex flex-col gap-2 rounded-md border border-primary/35 bg-primary/5 px-3 py-2.5">
          <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-primary">
            Joined · {joinGroup.tableIds.join(' + ')} · {joinGroup.capacity} seats
          </div>
          {canSplit && booking ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-start px-3"
              onClick={() => onSplit(booking.id, table.id)}
            >
              Split this table
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {booking && occupiedNow ? (
          <Button onClick={() => onClearTable(booking.id)} disabled={isClearing} className="w-full">
            Clear table
          </Button>
        ) : null}
        {booking && !occupiedNow && resolved.state === 'overdue' ? (
          <>
            <Button
              variant="destructive"
              onClick={() => onMarkNoShow(booking.id)}
              className="w-full"
            >
              Mark no-show
            </Button>
            <Button
              variant="outline"
              onClick={() => onClearTable(booking.id)}
              disabled={isClearing}
              className="w-full"
            >
              Clear
            </Button>
          </>
        ) : null}
        {booking && !occupiedNow && resolved.state !== 'overdue' ? (
          <Button onClick={() => onSeatParty(booking.id)} disabled={isSeating} className="w-full">
            Seat party
          </Button>
        ) : null}
        {!booking ? (
          <p className={cn('text-center text-xs text-muted-foreground')}>
            No booking on this table right now.
          </p>
        ) : null}
      </div>
    </>
  );
}
