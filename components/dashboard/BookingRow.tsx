'use client';

import { Button } from '@/components/ui/button';
import { StatusChip } from './StatusChip';
import type { BookingDTO } from '@/hooks/useBookings';

export type BookingRowProps = {
  booking: BookingDTO;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  onEdit: (booking: BookingDTO) => void;
  onCancel: (booking: BookingDTO) => void;
};

export function BookingRow({ booking, formatDate, formatTime, onEdit, onCancel }: BookingRowProps) {
  const isCancelled = booking.status === 'cancelled';

  return (
    <tr className="align-middle">
      <td className="px-4 py-4 text-sm text-foreground">{formatDate(booking.startIso)}</td>
      <td className="px-4 py-4 text-sm text-foreground">{formatTime(booking.startIso)}</td>
      <td className="px-4 py-4 text-sm text-foreground">{booking.partySize}</td>
      <td className="px-4 py-4 text-sm text-foreground">{booking.restaurantName}</td>
      <td className="px-4 py-4 text-sm text-foreground">
        <StatusChip status={booking.status} />
      </td>
      <td className="px-4 py-4 text-right text-sm text-foreground">
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-primary"
            disabled={isCancelled}
            onClick={() => onEdit(booking)}
            aria-disabled={isCancelled}
          >
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive/80"
            disabled={isCancelled}
            onClick={() => onCancel(booking)}
            aria-disabled={isCancelled}
          >
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  );
}
