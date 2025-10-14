'use client';

import { Button } from '@/components/ui/button';
import type { BookingDTO } from '@/hooks/useBookings';
import { cn } from '@/lib/utils';

import { OpsBookingDetailsDialog } from './OpsBookingDetailsDialog';
import { StatusChip } from './StatusChip';

export type BookingRowProps = {
  booking: BookingDTO;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  onEdit: (booking: BookingDTO) => void;
  onCancel: (booking: BookingDTO) => void;
  isPastView?: boolean;
  variant?: 'guest' | 'ops';
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

export function BookingRow({
  booking,
  formatDate,
  formatTime,
  onEdit,
  onCancel,
  isPastView = false,
  variant = 'guest',
}: BookingRowProps) {
  const isCancelled = booking.status === 'cancelled';
  const { displayStatus, isPast } = deriveBookingDisplayState(booking, { isPastView });
  const isOpsVariant = variant === 'ops';

  const textClass = (extra?: string) =>
    cn('px-4 py-4 text-sm', extra, isPast ? 'text-muted-foreground' : 'text-foreground');
  const disableActions = isCancelled || isPast;
  const customerLabel = booking.customerName?.trim() || 'Guest name unavailable';
  const notesLabel = booking.notes?.trim() || '—';
  const restaurantLabel = booking.restaurantName?.trim() || 'This restaurant';

  return (
    <tr className="align-middle">
      <td className={textClass()}>{formatDate(booking.startIso)}</td>
      <td className={textClass()}>{formatTime(booking.startIso)}</td>
      <td className={textClass()}>{booking.partySize}</td>
      {isOpsVariant ? (
        <>
          <td className={textClass()}>
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground" title={customerLabel}>
                {customerLabel}
              </span>
              {booking.customerEmail ? (
                <span className="text-xs text-muted-foreground" title={booking.customerEmail}>
                  {booking.customerEmail}
                </span>
              ) : null}
            </div>
          </td>
          <td className={textClass('max-w-xs text-muted-foreground')}>
            <p className="whitespace-pre-wrap break-words" title={booking.notes ?? undefined}>
              {notesLabel}
            </p>
          </td>
        </>
      ) : (
        <td className={textClass()} title={restaurantLabel}>
          {restaurantLabel}
        </td>
      )}
      <td className={textClass()}>
        <StatusChip status={displayStatus} />
      </td>
      <td className={textClass('text-right')}>
        <div className="flex justify-end gap-2">
          {isOpsVariant ? (
            <OpsBookingDetailsDialog booking={booking} formatDate={formatDate} formatTime={formatTime} />
          ) : null}
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
