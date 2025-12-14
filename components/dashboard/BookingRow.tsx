'use client';

import { useMemo, useState } from 'react';

import { BookingActionButton, BookingStatusBadge, StatusTransitionAnimator, type BookingActionSubject, type BookingAction } from '@/components/features/booking-state-machine';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { StatusChip } from './StatusChip';

import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsBookingStatus } from '@/types/ops';

export type BookingRowProps = {
  booking: BookingDTO;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  onEdit?: (booking: BookingDTO) => void;
  onCancel?: (booking: BookingDTO) => void;
  onDetails?: (booking: BookingDTO) => void;
  isPastView?: boolean;
  variant?: 'guest' | 'ops';
  opsActionMode?: 'full' | 'details-only';
  opsLifecycle?: {
    pendingBookingId: string | null;
    pendingAction: BookingAction | null;
    onCheckIn: (booking: BookingDTO) => Promise<void>;
    onCheckOut: (booking: BookingDTO) => Promise<void>;
    onMarkNoShow: (booking: BookingDTO, options?: { performedAt?: string | null; reason?: string | null }) => Promise<void>;
    onUndoNoShow: (booking: BookingDTO, reason?: string | null) => Promise<void>;
  };
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
  onDetails,
  isPastView = false,
  variant = 'guest',
  opsActionMode = 'full',
  opsLifecycle,
}: BookingRowProps) {
  const isCancelled = booking.status === 'cancelled';
  const { displayStatus, isPast } = deriveBookingDisplayState(booking, { isPastView });
  const isOpsVariant = variant === 'ops';
  const pendingAction = opsLifecycle && opsLifecycle.pendingBookingId === booking.id ? opsLifecycle.pendingAction : null;
  const actionSubject = useMemo<BookingActionSubject>(() => ({
    id: booking.id,
    status: booking.status as OpsBookingStatus,
    checkedInAt: null,
    checkedOutAt: null,
  }), [booking.id, booking.status]);
  const lifecycleAvailability = useMemo(() => {
    const start = new Date(booking.startIso);
    if (Number.isNaN(start.getTime())) {
      return { isToday: false } as const;
    }
    const today = new Date();
    return { isToday: start.toDateString() === today.toDateString() } as const;
  }, [booking.startIso]);

  const textClass = (extra?: string) =>
    cn('px-4 py-4 text-sm', extra, isPast ? 'text-muted-foreground' : 'text-foreground');
  const disableActions = isCancelled || isPast;
  const customerLabel = booking.customerName?.trim() || 'Guest name unavailable';
  const notesLabel = booking.notes?.trim() || '—';
  const restaurantLabel = booking.restaurantName?.trim() || 'This restaurant';
  const referenceLabel = booking.reference?.trim() || booking.id.slice(0, 8);

  const renderActions = () => (
    <div className="flex flex-wrap justify-end gap-1.5">
      {isOpsVariant && opsActionMode === 'full' && opsLifecycle ? (
        <BookingActionButton
          booking={actionSubject}
          pendingAction={pendingAction}
          onCheckIn={() => opsLifecycle.onCheckIn(booking)}
          onCheckOut={() => opsLifecycle.onCheckOut(booking)}
          onMarkNoShow={(options) => opsLifecycle.onMarkNoShow(booking, options)}
          onUndoNoShow={(reason) => opsLifecycle.onUndoNoShow(booking, reason)}
          showConfirmation
          lifecycleAvailability={lifecycleAvailability}
        />
      ) : null}
      {onDetails && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 min-w-[80px] px-3"
          onClick={() => onDetails(booking)}
        >
          Details
        </Button>
      )}
      {(!isOpsVariant || opsActionMode === 'full') && (onEdit || onCancel) ? (
        <>
          {onEdit ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-primary"
              disabled={disableActions}
              onClick={() => onEdit(booking)}
              aria-disabled={disableActions}
            >
              Edit
            </Button>
          ) : null}
          {onCancel ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-destructive hover:text-destructive/80"
              disabled={disableActions}
              onClick={() => onCancel(booking)}
              aria-disabled={disableActions}
            >
              Cancel
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );

  if (isOpsVariant) {
    return (
      <tr className="align-top" data-booking-id={booking.id}>
        <td className={textClass('py-3')}>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span>{formatDate(booking.startIso)}</span>
              <span className="text-muted-foreground">•</span>
              <span>{formatTime(booking.startIso)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Ref {referenceLabel}</p>
          </div>
        </td>

        <td className={textClass('py-3')}>
          <div className="space-y-1">
            <span className="font-semibold text-foreground">{customerLabel}</span>
            {booking.customerEmail ? (
              <a
                href={`mailto:${booking.customerEmail}`}
                className="block text-xs text-muted-foreground hover:text-foreground"
                title={booking.customerEmail}
              >
                {booking.customerEmail}
              </a>
            ) : null}
            {booking.customerPhone ? (
              <a
                href={`tel:${booking.customerPhone.replace(/[^+\d]/g, '')}`}
                className="block text-xs text-muted-foreground hover:text-foreground"
                title={booking.customerPhone}
              >
                {booking.customerPhone}
              </a>
            ) : null}
          </div>
        </td>

        <td className={textClass('py-3')}>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span>Party of {booking.partySize}</span>
            </div>
            {booking.requiresTableAssignment ? (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                Needs table
              </span>
            ) : null}
          </div>
        </td>

        <td className={textClass('py-3')}>
          <div className="space-y-1 text-sm">
            <p className="line-clamp-2 text-foreground/90" title={notesLabel}>
              {notesLabel}
            </p>
          </div>
        </td>

        <td className={textClass('py-3')}>
          <StatusTransitionAnimator
            status={booking.status as OpsBookingStatus}
            className="inline-flex rounded-full"
            overlayClassName="inline-flex"
          >
            <BookingStatusBadge status={booking.status as OpsBookingStatus} />
          </StatusTransitionAnimator>
        </td>

        <td className={textClass('py-3 text-right')}>
          {renderActions()}
        </td>
      </tr>
    );
  }

  return (
    <tr className="align-middle" data-booking-id={booking.id}>
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
        {isOpsVariant && opsLifecycle ? (
          <StatusTransitionAnimator
            status={booking.status as OpsBookingStatus}
            className="inline-flex rounded-full"
            overlayClassName="inline-flex"
          >
            <BookingStatusBadge status={booking.status as OpsBookingStatus} />
          </StatusTransitionAnimator>
        ) : (
          <StatusChip status={displayStatus} />
        )}
      </td>
      <td className={textClass('text-right')}>
        {renderActions()}
      </td>
    </tr>
  );
}
