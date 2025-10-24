'use client';

import React, { useId } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { BookingDTO } from '@/hooks/useBookings';
import { cn } from '@/lib/utils';

import { deriveBookingDisplayState } from './BookingRow';
import { EmptyState, type EmptyStateProps } from './EmptyState';
import { StatusChip } from './StatusChip';

export type BookingsListMobileProps = {
  bookings: BookingDTO[];
  isLoading: boolean;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  onEdit: (booking: BookingDTO) => void;
  onCancel: (booking: BookingDTO) => void;
  allowEdit?: boolean;
  emptyState?: EmptyStateProps;
  isPastView?: boolean;
  variant?: 'guest' | 'ops';
};

const skeletonCards = Array.from({ length: 3 }, (_, index) => index);

function BookingCard({
  booking,
  formatDate,
  formatTime,
  onEdit,
  onCancel,
  allowEdit = true,
  isPastView,
  cardId,
  variant,
}: {
  booking: BookingDTO;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  onEdit: (booking: BookingDTO) => void;
  onCancel: (booking: BookingDTO) => void;
  allowEdit?: boolean;
  isPastView: boolean;
  cardId: string;
  variant: 'guest' | 'ops';
}) {
  const { displayStatus, isPast } = deriveBookingDisplayState(booking, { isPastView });
  const restaurantLabel = booking.restaurantName?.trim() || 'this restaurant';
  const customerLabel = booking.customerName?.trim() || 'Guest name unavailable';
  const emailLabel = booking.customerEmail?.trim() || null;
  const headingLabel = variant === 'ops' ? customerLabel : restaurantLabel;
  const disableActions = booking.status === 'cancelled' || isPast;
  const headingId = `${cardId}-heading`;
  const detailsId = `${cardId}-details`;

  return (
    <Card
      role="article"
      aria-labelledby={headingId}
      aria-describedby={detailsId}
      className="space-y-4 border-border/80 bg-card/95 p-4 shadow-sm backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-y-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{formatDate(booking.startIso)}</p>
          <p className="text-sm text-muted-foreground/80">{formatTime(booking.startIso)}</p>
        </div>
        <StatusChip status={displayStatus} />
      </div>
      <div id={headingId} className="space-y-1 text-lg font-semibold text-foreground">
        <div>{headingLabel}</div>
        {variant === 'ops' && emailLabel ? (
          <p className="text-sm font-normal text-muted-foreground" title={emailLabel}>
            {emailLabel}
          </p>
        ) : null}
      </div>
      <dl id={detailsId} className="space-y-1 text-sm text-muted-foreground">
        <div className="flex items-center justify-between text-foreground">
          <dt className="font-medium">Party</dt>
          <dd>Party of {booking.partySize}</dd>
        </div>
        {variant === 'ops' ? (
          <>
            <div className="flex items-center justify-between text-foreground">
              <dt className="font-medium">Restaurant</dt>
              <dd className="text-right text-muted-foreground">{restaurantLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Notes</dt>
              <dd className="text-muted-foreground">{booking.notes?.trim() || '—'}</dd>
            </div>
          </>
        ) : booking.notes ? (
          <div>
            <dt className="font-medium text-foreground">Notes</dt>
            <dd className="text-muted-foreground">{booking.notes}</dd>
          </div>
        ) : null}
      </dl>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {allowEdit ? (
          <Button
            type="button"
            variant="outline"
            className={cn('h-11 w-full sm:w-auto')}
            onClick={() => onEdit(booking)}
            disabled={disableActions}
            aria-disabled={disableActions}
            aria-label={`Edit booking ${variant === 'ops' ? `for ${customerLabel}` : `at ${restaurantLabel}`}`}
          >
            Edit booking
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className={cn('h-11 w-full sm:w-auto text-destructive')}
          onClick={() => onCancel(booking)}
          disabled={disableActions}
          aria-disabled={disableActions}
          aria-label={`Cancel booking ${variant === 'ops' ? `for ${customerLabel}` : `at ${restaurantLabel}`}`}
        >
          Cancel booking
        </Button>
      </div>
    </Card>
  );
}

function renderSkeletonCard(key: number) {
  return (
    <Card
      key={`skeleton-${key}`}
      data-testid="booking-card-skeleton"
      className="space-y-4 border-border/60 bg-card/70 p-4"
      aria-hidden="true"
    >
      <div className="flex justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Skeleton className="h-11 w-full sm:w-32" />
        <Skeleton className="h-11 w-full sm:w-32" />
      </div>
    </Card>
  );
}

export function BookingsListMobile({
  bookings,
  isLoading,
  formatDate,
  formatTime,
  onEdit,
  onCancel,
  allowEdit,
  emptyState,
  isPastView = false,
  variant = 'guest',
}: BookingsListMobileProps) {
  const baseId = useId();

  if (isLoading) {
    return <div className="space-y-3">{skeletonCards.map((card) => renderSkeletonCard(card))}</div>;
  }

  if (bookings.length === 0) {
    return <EmptyState {...emptyState} />;
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
          formatDate={formatDate}
          formatTime={formatTime}
          onEdit={onEdit}
          onCancel={onCancel}
          allowEdit={allowEdit}
          isPastView={isPastView}
          cardId={`${baseId}-${booking.id}`}
          variant={variant}
        />
      ))}
    </div>
  );
}
