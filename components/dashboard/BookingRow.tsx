'use client';

import { Button } from '@/components/ui/button';
import type { BookingDTO } from '@/hooks/useBookings';
import { cn } from '@/lib/utils';

import { StatusChip } from './StatusChip';

export type BookingRowProps = {
  booking: BookingDTO;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  onEdit: (booking: BookingDTO) => void;
  onCancel: (booking: BookingDTO) => void;
  isPastView?: boolean;
};

export function isBookingPast(booking: BookingDTO): boolean {
  const startDate = new Date(booking.startIso);
  const isPastByTime = !Number.isNaN(startDate.getTime()) && startDate.getTime() < Date.now();
  return isPastByTime || booking.status === 'completed' || booking.status === 'no_show';
}

export function deriveBookingDisplayState(
  booking: BookingDTO,
  { isPastView = false }: { isPastView?: boolean } = {},
): { displayStatus: BookingDTO['status']; isPast: boolean } {
  const isPast = isPastView || isBookingPast(booking);

  let displayStatus: BookingDTO['status'] = booking.status;
  if (isPast) {
    if (displayStatus === 'confirmed') {
      displayStatus = 'completed';
    } else if (displayStatus === 'pending' || displayStatus === 'pending_allocation') {
      displayStatus = 'no_show';
    }
  }

  return { displayStatus, isPast };
}

export function BookingRow({ booking, formatDate, formatTime, onEdit, onCancel, isPastView = false }: BookingRowProps) {
  const isCancelled = booking.status === 'cancelled';
  const { displayStatus, isPast } = deriveBookingDisplayState(booking, { isPastView });

  const textClass = (extra?: string) =>
    cn('px-4 py-4 text-sm', extra, isPast ? 'text-muted-foreground' : 'text-foreground');
  const disableActions = isCancelled || isPast;

  return (
    <tr className="align-middle">
      <td className={textClass()}>{formatDate(booking.startIso)}</td>
      <td className={textClass()}>{formatTime(booking.startIso)}</td>
      <td className={textClass()}>{booking.partySize}</td>
      <td className={textClass()}>{booking.restaurantName}</td>
      <td className={textClass()}>
        <StatusChip status={displayStatus} />
      </td>
      <td className={textClass('text-right')}>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-primary"
            disabled={disableActions}
            onClick={() => onEdit(booking)}
            aria-disabled={disableActions}
          >
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive/80"
            disabled={disableActions}
            onClick={() => onCancel(booking)}
            aria-disabled={disableActions}
          >
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  );
}
