'use client';

import React, { useId } from 'react';

import {
  AlertTriangle,
  Armchair,
  Check,
  Clock,
  FileText,
  Sparkles,
  Users,
  Utensils,
} from 'lucide-react';
import { DateTime } from 'luxon';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { deriveBookingDisplayState } from './BookingRow';
import { EmptyState, type EmptyStateProps } from './EmptyState';
import { StatusChip } from './StatusChip';

import type { BookingDTO } from '@/hooks/useBookings';

export type BookingsListMobileProps = {
  bookings: BookingDTO[];
  isLoading: boolean;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  onEdit?: (booking: BookingDTO) => void;
  onCancel?: (booking: BookingDTO) => void;
  onDetails?: (booking: BookingDTO) => void;
  opsActionMode?: 'full' | 'details-only';
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
  onDetails,
  opsActionMode,
  isPastView,
  cardId,
  variant,
}: {
  booking: BookingDTO;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  onEdit?: (booking: BookingDTO) => void;
  onCancel?: (booking: BookingDTO) => void;
  onDetails?: (booking: BookingDTO) => void;
  opsActionMode?: 'full' | 'details-only';
  isPastView: boolean;
  cardId: string;
  variant: 'guest' | 'ops';
}) {
  const { displayStatus, isPast } = deriveBookingDisplayState(booking, { isPastView });
  const restaurantLabel = booking.restaurantName?.trim() || 'this restaurant';
  const customerLabel = booking.customerName?.trim() || 'Guest name unavailable';
  const emailLabel = booking.customerEmail?.trim() || null;
  const phoneLabel = booking.customerPhone?.trim() || null;
  const notesLabel = booking.notes?.trim() || null;
  const referenceLabel = booking.reference?.trim() || booking.id.slice(0, 8);
  const headingLabel = variant === 'ops' ? customerLabel : restaurantLabel;
  const isDone = displayStatus === 'completed' || displayStatus === 'cancelled' || displayStatus === 'no_show';
  const disableActions = displayStatus === 'cancelled' || isPast;
  const hideEditCancel = variant === 'ops' && opsActionMode === 'details-only';
  const headingId = `${cardId}-heading`;
  const detailsId = `${cardId}-details`;

  const startTimeLabel = formatTime(booking.startIso);
  const endTimeLabel = booking.endIso ? formatTime(booking.endIso) : null;
  const timeRangeLabel = endTimeLabel ? `${startTimeLabel} – ${endTimeLabel}` : startTimeLabel;

  const initialsSource = headingLabel;
  const initials = initialsSource
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card
      role="row"
      aria-labelledby={headingId}
      aria-describedby={detailsId}
      className={cn(
        'group relative flex flex-col gap-3 p-3 transition-all',
        isDone ? 'border-muted bg-muted/50' : 'border-border/70 bg-card',
        'hover:shadow-md active:shadow-sm',
      )}
      data-testid="mobile-booking-row"
    >
      {/* ZONE 1: Logistics (time + party) */}
      <div className="flex items-center justify-between gap-3" role="cell">
        <div className="flex min-w-[110px] flex-col">
          <span className={cn('font-mono text-lg font-bold leading-none tracking-tight', isDone ? 'text-muted-foreground' : 'text-foreground')}>
            {startTimeLabel}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {endTimeLabel ? `Until ${endTimeLabel}` : formatDate(booking.startIso)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Users className={cn('h-3.5 w-3.5', isDone ? 'text-muted-foreground/60' : 'text-muted-foreground')} />
          <span className={cn('text-sm font-medium', isDone ? 'text-muted-foreground' : 'text-foreground/80')}>
            {booking.partySize} guests
          </span>
        </div>
      </div>

      {/* ZONE 2: Identity (avatar + name + status + metadata) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Avatar className={cn(isDone ? 'bg-muted' : 'bg-primary/10')}>
            <AvatarFallback className={cn('text-xs font-bold', isDone ? 'text-muted-foreground' : 'text-primary')}>
              {initials || '—'}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  id={headingId}
                  className={cn(
                    'truncate text-base font-semibold',
                    isDone ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'text-foreground',
                  )}
                  title={headingLabel}
                >
                  {headingLabel}
                </p>
                <p id={detailsId} className="text-xs text-muted-foreground" title={timeRangeLabel}>
                  {formatDate(booking.startIso)} · {timeRangeLabel}
                </p>
              </div>
              <StatusChip status={displayStatus} />
            </div>

            {variant === 'ops' ? (
              <div className="mt-1 space-y-0.5">
                {emailLabel ? (
                  <a
                    href={`mailto:${emailLabel}`}
                    className="block truncate text-xs text-muted-foreground hover:text-foreground"
                    title={emailLabel}
                  >
                    {emailLabel}
                  </a>
                ) : null}
                {phoneLabel ? (
                  <a
                    href={`tel:${phoneLabel.replace(/[^+\d]/g, '')}`}
                    className="block text-xs text-muted-foreground hover:text-foreground"
                    title={phoneLabel}
                  >
                    {phoneLabel}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {variant === 'ops' ? (
            <Badge variant="outline" className="rounded-full">
              Ref {referenceLabel}
            </Badge>
          ) : null}

          {booking.requiresTableAssignment ? (
            <Badge variant="outline" className="rounded-full">
              Needs table
            </Badge>
          ) : null}

          {notesLabel ? (
            <Badge
              variant="default"
              className="gap-1 max-w-[240px] truncate"
              title={notesLabel}
            >
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{notesLabel}</span>
            </Badge>
          ) : variant === 'ops' ? (
            <Badge variant="secondary" className="rounded-full">
              No notes
            </Badge>
          ) : null}
        </div>
      </div>

      {/* ZONE 3: Actions */}
      <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:justify-end" role="cell">
        {onDetails ? (
          <Button
            type="button"
            variant="outline"
            className={cn('h-11 w-full touch-manipulation sm:w-auto')}
            onClick={() => onDetails(booking)}
            aria-label={`View details for booking ${variant === 'ops' ? `for ${customerLabel}` : `at ${restaurantLabel}`}`}
          >
            Details
          </Button>
        ) : null}
        {hideEditCancel ? null : onEdit || onCancel ? (
          <>
            {onEdit ? (
              <Button
                type="button"
                variant="outline"
                className={cn('h-11 w-full touch-manipulation sm:w-auto')}
                onClick={() => onEdit(booking)}
                disabled={disableActions}
                aria-disabled={disableActions}
                aria-label={`Edit booking ${variant === 'ops' ? `for ${customerLabel}` : `at ${restaurantLabel}`}`}
              >
                Edit booking
              </Button>
            ) : null}
            {onCancel ? (
              <Button
                type="button"
                variant="ghost"
                className={cn('h-11 w-full touch-manipulation sm:w-auto text-destructive')}
                onClick={() => onCancel(booking)}
                disabled={disableActions}
                aria-disabled={disableActions}
                aria-label={`Cancel booking ${variant === 'ops' ? `for ${customerLabel}` : `at ${restaurantLabel}`}`}
              >
                Cancel
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}

function renderSkeletonCard(key: number) {
  return (
    <Card
      key={`skeleton-${key}`}
      data-testid="booking-card-skeleton"
      className="border-border/60 bg-card/70 p-3"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3.5 w-32" />
        </div>
        <Skeleton className="h-4 w-20 rounded-full" />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3.5 w-40" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:justify-end">
        <Skeleton className="h-11 w-full sm:w-32" />
      </div>
    </Card>
  );
}

const StatusIndicator = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pending: 'bg-amber-500',
    pending_allocation: 'bg-amber-500',
    confirmed: 'bg-blue-500',
    PRIORITY_WAITLIST: 'bg-blue-500',
    checked_in: 'bg-emerald-500',
    completed: 'bg-slate-400',
    no_show: 'bg-rose-500',
    cancelled: 'bg-slate-300',
  };

  const labels: Record<string, string> = {
    confirmed: 'Expected',
    PRIORITY_WAITLIST: 'Expected',
    pending: 'Pending',
    pending_allocation: 'Pending',
    checked_in: 'Seated',
    completed: 'Left',
    no_show: 'No Show',
    cancelled: 'Cancelled',
  };

  const colorClass = styles[status] || styles['confirmed'];
  const label = labels[status] || status.replace('_', ' ');

  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2 w-2 rounded-full', colorClass)} />
      <span className={cn('text-xs font-medium', status === 'completed' || status === 'cancelled' ? 'text-slate-400' : 'text-slate-700')}>
        {label}
      </span>
    </div>
  );
};

const TableAssignment = ({ assignments, status }: {
  assignments: BookingDTO['tableAssignments'],
  status: string,
}) => {
  if (!assignments || assignments.length === 0) {
    if (status === 'confirmed' || status === 'PRIORITY_WAITLIST') {
      return (
        <div className="flex items-center gap-1.5 text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">No Table</span>
        </div>
      );
    }
    return <span className="text-xs text-slate-400 italic">No table</span>;
  }

  // Generate table label
  const labels: string[] = [];
  for (const group of assignments) {
    const members = group.members ?? [];
    const memberLabels = members.map((member) => member.tableNumber || '—');
    labels.push(memberLabels.join(' + '));
  }
  const displayTables = labels.join(', ');

  return (
    <div className="flex items-center gap-1.5 text-slate-700">
      <Armchair className="h-3.5 w-3.5 text-slate-400" />
      <span className="text-xs font-semibold">Table {displayTables}</span>
    </div>
  );
};

function OpsMobileBookingCard({
  booking,
  formatDate,
  formatTime,
  onEdit,
  onCancel,
  onDetails,
  opsActionMode,
  isPastView,
}: {
  booking: BookingDTO;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  onEdit?: (booking: BookingDTO) => void;
  onCancel?: (booking: BookingDTO) => void;
  onDetails?: (booking: BookingDTO) => void;
  opsActionMode?: 'full' | 'details-only';
  isPastView: boolean;
}) {
  const { displayStatus, isPast } = deriveBookingDisplayState(booking, { isPastView });
  const isDone = displayStatus === 'completed' || displayStatus === 'cancelled' || displayStatus === 'no_show';
  const isUpcoming = displayStatus === 'confirmed' || displayStatus === 'PRIORITY_WAITLIST';
  const disableActions = displayStatus === 'cancelled' || isPast;
  const hideEditCancel = opsActionMode === 'details-only';

  const startTimeStr = formatTime(booking.startIso);
  const endTimeStr = booking.endIso ? formatTime(booking.endIso) : null;

  // Time urgency calculation (simplified for mobile list without full timezone context)
  const timeUrgency = React.useMemo(() => {
    if (!isUpcoming) return null;
    const start = DateTime.fromISO(booking.startIso);
    if (!start.isValid) return null;

    const now = DateTime.now();
    const diffMinutes = start.diff(now, 'minutes').minutes;

    if (diffMinutes <= -15) {
      return { type: 'late' as const, label: `${Math.abs(Math.round(diffMinutes))} min late` };
    } else if (diffMinutes <= 0 && diffMinutes > -15) {
      return { type: 'overdue' as const, label: 'Past time' };
    } else if (diffMinutes <= 10 && diffMinutes > 0) {
      return { type: 'soon' as const, label: `${Math.round(diffMinutes)} min` };
    }
    return null;
  }, [isUpcoming, booking.startIso]);

  // Guest Initials
  const guestInitials = (booking.customerName || 'Guest')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Determine card urgency variant
  const cardUrgencyClass = React.useMemo(() => {
    if (isDone) return 'border-muted bg-muted/50';
    if (timeUrgency?.type === 'late') return 'border-destructive/50 bg-destructive/5';
    if (timeUrgency?.type === 'overdue') return 'border-warning/50 bg-warning/5';
    if (timeUrgency?.type === 'soon') return 'border-warning/30 bg-warning/5';
    return 'border-slate-200 bg-white shadow-sm';
  }, [isDone, timeUrgency]);

  return (
    <Card className={cn(
      'group relative flex flex-col gap-3 p-3 transition-all sm:gap-4 sm:p-4 sm:flex-row sm:items-center',
      cardUrgencyClass,
      'hover:shadow-md active:shadow-sm'
    )}>
      {/* ZONE 1: LOGISTICS (Time & Party) */}
      <div className="flex min-w-[100px] shrink-0 flex-row items-center gap-4 sm:flex-col sm:items-start sm:gap-1">
        <div className="flex flex-col">
          <span className={cn('font-mono text-lg font-bold leading-none tracking-tight', isDone ? 'text-slate-400' : 'text-slate-900')}>
            {startTimeStr}
          </span>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
            {endTimeStr ? `Until ${endTimeStr}` : formatDate(booking.startIso)}
          </span>
        </div>

        <div className="hidden h-px w-8 bg-slate-100 sm:block" />

        <div className="flex items-center gap-1.5">
          <Users className={cn('h-3.5 w-3.5', isDone ? 'text-slate-300' : 'text-slate-400')} />
          <span className={cn('text-sm font-medium', isDone ? 'text-slate-400' : 'text-slate-700')}>
            {booking.partySize} guests
          </span>
        </div>

        {/* Time Urgency Badge */}
        {timeUrgency && (
          <Badge
            variant={timeUrgency.type === 'late' ? 'destructive' : 'secondary'}
            className={cn(
              'gap-1 rounded-full text-[10px]',
              timeUrgency.type === 'overdue' && 'bg-amber-100 text-amber-700 border-amber-200',
              timeUrgency.type === 'soon' && 'bg-amber-50 text-amber-600 border-amber-100'
            )}
          >
            <Clock className="h-3 w-3" />
            {timeUrgency.label}
          </Badge>
        )}
      </div>

      {/* ZONE 2: IDENTITY (Guest Info, Status, Tags) */}
      <div className="flex flex-1 flex-col gap-2">
        {/* Name & Tier */}
        <div className="flex items-center gap-3">
          <Avatar className={cn(
            isDone ? 'bg-muted' : 'bg-primary/10'
          )}>
            <AvatarFallback className={cn(
              'text-xs font-bold',
              isDone ? 'text-muted-foreground' : 'text-primary'
            )}>
              {guestInitials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className={cn('text-base font-semibold', isDone ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900')}>
                {booking.customerName || 'Guest'}
              </span>
              {booking.loyaltyTier && (
                <Sparkles
                  className={cn(
                    'h-3.5 w-3.5',
                    booking.loyaltyTier === 'platinum' ? 'text-indigo-500' :
                      booking.loyaltyTier === 'gold' ? 'text-amber-500' : 'text-slate-400'
                  )}
                  fill="currentColor"
                />
              )}
            </div>
            {booking.customerEmail && (
              <span className="text-xs text-slate-400 block truncate max-w-[200px]">{booking.customerEmail}</span>
            )}
          </div>
        </div>

        {/* Status & Table Line */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatusIndicator status={displayStatus} />
          <div className="h-3 w-px bg-slate-200" />
          <TableAssignment
            assignments={booking.tableAssignments}
            status={displayStatus}
          />
        </div>

        {/* Tags (Allergies, Notes, Prefs) */}
        {(booking.allergies?.length || booking.notes || booking.seatingPreference || booking.dietaryRestrictions) ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {booking.allergies?.map((allergy, i) => (
              <Badge key={`alg-${i}`} variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {allergy}
              </Badge>
            ))}
            {booking.notes && (
              <Badge variant="secondary" className="gap-1 max-w-[200px] truncate bg-amber-50 text-amber-800 border-amber-200" title={booking.notes}>
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{booking.notes}</span>
              </Badge>
            )}
            {booking.seatingPreference && (
              <Badge variant="secondary" className="gap-1 max-w-[150px] truncate" title={booking.seatingPreference}>
                <Armchair className="h-3 w-3 shrink-0" />
                <span className="truncate">{booking.seatingPreference}</span>
              </Badge>
            )}
            {booking.dietaryRestrictions && booking.dietaryRestrictions.length > 0 && (
              <Badge variant="outline" className="gap-1 max-w-[150px] truncate bg-amber-50 text-amber-700 border-amber-200" title={booking.dietaryRestrictions.join(', ')}>
                <Utensils className="h-3 w-3 shrink-0" />
                <span className="truncate">{booking.dietaryRestrictions.join(', ')}</span>
              </Badge>
            )}
          </div>
        ) : null}
      </div>

      {/* ZONE 3: ACTIONS */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 pt-3 sm:mt-0 sm:flex-col sm:items-end sm:border-0 sm:pt-0 sm:gap-3">
        {!isDone ? (
          <>
            {onDetails ? (
              <Button
                type="button"
                variant="outline"
                className={cn('h-9 px-4 sm:w-auto text-xs')}
                onClick={() => onDetails(booking)}
              >
                Details
              </Button>
            ) : null}
            {!hideEditCancel && (onEdit || onCancel) ? (
              <div className="flex gap-1">
                {onEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 text-slate-500 hover:text-slate-900"
                    disabled={disableActions}
                    onClick={() => onEdit(booking)}
                  >
                    Edit
                  </Button>
                ) : null}
                {onCancel ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    disabled={disableActions}
                    onClick={() => onCancel(booking)}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <Button size="sm" variant="ghost" className="w-full cursor-default text-slate-400 hover:bg-transparent hover:text-slate-400 sm:w-auto" disabled>
            <Check className="mr-2 h-3.5 w-3.5" />
            {displayStatus === 'completed' ? 'Completed' : 'Cancelled'}
          </Button>
        )}
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
  onDetails,
  opsActionMode,
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
    <div className="space-y-4" role="table" aria-label="Bookings list (mobile view)">
      {bookings.map((booking) => {
        if (variant === 'ops') {
          return (
            <OpsMobileBookingCard
              key={booking.id}
              booking={booking}
              formatDate={formatDate}
              formatTime={formatTime}
              onEdit={onEdit}
              onCancel={onCancel}
              onDetails={onDetails}
              opsActionMode={opsActionMode}
              isPastView={isPastView}
            />
          );
        }
        return (
          <BookingCard
            key={booking.id}
            booking={booking}
            formatDate={formatDate}
            formatTime={formatTime}
            onEdit={onEdit}
            onCancel={onCancel}
            onDetails={onDetails}
            opsActionMode={opsActionMode}
            isPastView={isPastView}
            cardId={`${baseId}-${booking.id}`}
            variant={variant}
          />
        );
      })}
    </div>
  );
}
