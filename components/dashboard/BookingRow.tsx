'use client';

import { useMemo, useState } from 'react';

import { BookingActionButton, BookingStatusBadge, StatusTransitionAnimator, type BookingActionSubject, type BookingAction } from '@/components/features/booking-state-machine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { cn } from '@/lib/utils';

import { StatusChip } from './StatusChip';

import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsBookingStatus } from '@/types/ops';

export type BookingRowProps = {
  booking: BookingDTO;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  onEdit: (booking: BookingDTO) => void;
  onCancel: (booking: BookingDTO) => void;
  onDetails?: (booking: BookingDTO) => void;
  isPastView?: boolean;
  variant?: 'guest' | 'ops';
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

  const tableAssignments = booking.tableAssignments ?? [];
  const tablesCount = tableAssignments.reduce((sum, group) => sum + group.members.length, 0);
  const assignedCapacity = tableAssignments.reduce((sum, group) => {
    if (typeof group.capacitySum === 'number') return sum + group.capacitySum;
    const membersCapacity = group.members.reduce((acc, member) => acc + (member.capacity ?? 0), 0);
    return sum + membersCapacity;
  }, 0);
  const hasAssignments = tableAssignments.length > 0;
  const capacityDelta = hasAssignments ? assignedCapacity - booking.partySize : null;
  const deltaTone = capacityDelta !== null && capacityDelta < 0 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200';
  const referenceLabel = booking.reference?.trim() || booking.id.slice(0, 8);
  const sourceLabel = booking.source?.trim() || null;
  const loyaltyLabel = booking.loyaltyTier ? `${booking.loyaltyTier} ${booking.loyaltyPoints ? `· ${booking.loyaltyPoints} pts` : ''}` : null;
  const seatingPreference = booking.seatingPreference?.trim() || null;
  const allergies = booking.allergies?.filter(Boolean) ?? [];
  const dietary = booking.dietaryRestrictions?.filter(Boolean) ?? [];

  const renderFlagBadge = (label: string, tone: 'neutral' | 'warn' | 'info' = 'neutral') => (
    <Badge
      key={label}
      variant="outline"
      className={cn(
        'rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize',
        tone === 'warn' && 'border-amber-300 bg-amber-50 text-amber-800',
        tone === 'info' && 'border-blue-200 bg-blue-50 text-blue-800'
      )}
    >
      {label}
    </Badge>
  );

  const renderActions = () => (
    <div className="flex flex-wrap justify-end gap-1.5">
      {isOpsVariant && opsLifecycle ? (
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
    </div>
  );

  if (isOpsVariant) {
    return (
      <tr className="align-top">
        <td className={textClass('py-3')}>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span>{formatDate(booking.startIso)}</span>
              <span className="text-muted-foreground">•</span>
              <span>{formatTime(booking.startIso)}</span>
            </div>
            <div className="group/ref flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="outline" className="rounded-full border-muted px-2 py-0.5 text-[11px] font-medium">
                Ref {referenceLabel}
              </Badge>
              <CopyButton
                text={booking.reference ?? booking.id}
                label="booking reference"
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 transition-opacity group-hover/ref:opacity-100 focus-visible:opacity-100"
                showToast
              />
              {sourceLabel ? renderFlagBadge(sourceLabel, 'info') : null}
              {booking.checkedInAt ? renderFlagBadge('Checked in') : null}
              {booking.checkedOutAt ? renderFlagBadge('Checked out') : null}
            </div>
          </div>
        </td>

        <td className={textClass('py-3')}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{customerLabel}</span>
              {loyaltyLabel ? renderFlagBadge(loyaltyLabel, 'info') : null}
            </div>
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
              <span>{booking.partySize} guests</span>
              {tablesCount ? (
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-medium">
                  {tablesCount} table{tablesCount === 1 ? '' : 's'}
                </Badge>
              ) : null}
            </div>
            {capacityDelta !== null ? (
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', deltaTone)}>
                {capacityDelta >= 0 ? '+' : ''}
                {capacityDelta} seats vs party
              </span>
            ) : booking.requiresTableAssignment ? (
              renderFlagBadge('Needs table', 'warn')
            ) : null}
            {seatingPreference ? (
              <p className="text-xs text-muted-foreground" title={seatingPreference}>
                Preference: {seatingPreference}
              </p>
            ) : null}
          </div>
        </td>

        <td className={textClass('py-3')}>
          <div className="space-y-1 text-sm">
            <p className="line-clamp-2 text-foreground/90" title={notesLabel}>
              {notesLabel}
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-medium text-muted-foreground">
              {allergies.slice(0, 2).map((item) => renderFlagBadge(item, 'warn'))}
              {allergies.length > 2 ? renderFlagBadge(`+${allergies.length - 2} more`, 'warn') : null}
              {dietary.slice(0, 2).map((item) => renderFlagBadge(item, 'info'))}
              {dietary.length > 2 ? renderFlagBadge(`+${dietary.length - 2} more`, 'info') : null}
            </div>
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
