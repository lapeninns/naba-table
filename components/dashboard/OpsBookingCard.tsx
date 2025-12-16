import {
  AlertTriangle,
  Armchair,
  Check,
  Clock,
  FileText,
  LogIn,
  LogOut,
  Sparkles,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { DateTime } from 'luxon';
import { useMemo } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { deriveBookingDisplayState, isBookingPast } from './BookingRow';

import type { BookingDTO } from '@/hooks/useBookings';

export type OpsBookingCardProps = {
  booking: BookingDTO;
  timezone: string;
  now?: DateTime; // Defaults to DateTime.now().setZone(timezone)
  onEdit?: (booking: BookingDTO) => void;
  onCancel?: (booking: BookingDTO) => void;
  onDetails?: (booking: BookingDTO) => void;
  onCheckIn?: (bookingId: string) => Promise<void>;
  onCheckOut?: (bookingId: string) => Promise<void>;
  onMarkNoShow?: (bookingId: string) => Promise<void>;
  onUndoNoShow?: (bookingId: string) => Promise<void>;
  onAssignTable?: (bookingId: string, tableId: string) => Promise<any>;
  onUnassignTable?: (bookingId: string, tableId: string) => Promise<any>;
  pendingAction?: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show' | null;
  allowTableAssignments?: boolean;
  highlightUrgency?: boolean;
};

function getTableLabel(assignments: BookingDTO['tableAssignments']) {
  if (!assignments || assignments.length === 0) {
    return null;
  }

  const labels: string[] = [];
  for (const group of assignments) {
    const members = group.members ?? [];
    const memberLabels = members.map((member) => member.tableNumber || '—');
    labels.push(memberLabels.join(' + '));
  }
  return labels.join(', ');
}

function StatusPill({ status }: { status: string }) {
  const dotClasses: Record<string, string> = {
    pending: 'bg-amber-500',
    pending_allocation: 'bg-amber-500',
    confirmed: 'bg-blue-500',
    PRIORITY_WAITLIST: 'bg-blue-500',
    checked_in: 'bg-emerald-500',
    completed: 'bg-muted-foreground/40',
    no_show: 'bg-rose-500',
    cancelled: 'bg-muted-foreground/40',
  };

  const labels: Record<string, string> = {
    confirmed: 'Expected',
    PRIORITY_WAITLIST: 'Expected',
    pending: 'Pending',
    pending_allocation: 'Pending',
    checked_in: 'Seated',
    completed: 'Left',
    no_show: 'No show',
    cancelled: 'Cancelled',
  };

  const label = labels[status] || status.replaceAll('_', ' ');
  const dotClass = dotClasses[status] || dotClasses.confirmed;
  const muted = status === 'completed' || status === 'cancelled';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        muted ? 'border-border/50 bg-muted/30 text-muted-foreground' : 'border-border/60 bg-background/60 text-foreground',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} aria-hidden />
      {label}
    </span>
  );
}

export function OpsBookingCard({
  booking,
  timezone,
  now: propNow,
  onEdit,
  onCancel,
  onDetails,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  pendingAction,
  highlightUrgency = true,
}: OpsBookingCardProps) {
  const now = useMemo(() => propNow ?? DateTime.now().setZone(timezone), [propNow, timezone]);

  const { displayStatus } = deriveBookingDisplayState(booking, { isPastView: false });
  const isPastBooking = isBookingPast(booking);

  const isDone = booking.status === 'completed' || booking.status === 'cancelled' || booking.status === 'no_show';
  const isSeated = booking.status === 'checked_in';
  const isUpcoming =
    !isDone &&
    (displayStatus === 'confirmed' ||
      displayStatus === 'PRIORITY_WAITLIST' ||
      booking.status === 'pending' ||
      booking.status === 'pending_allocation');

  const isLoading = Boolean(pendingAction);
  const customerLabel = booking.customerName?.trim() || 'Guest name unavailable';
  const emailLabel = booking.customerEmail?.trim() || null;
  const phoneLabel = booking.customerPhone?.trim() || null;
  const referenceLabel = booking.reference?.trim() || booking.id.slice(0, 8);
  const tableLabel = getTableLabel(booking.tableAssignments);

  const startIso = DateTime.fromISO(booking.startIso).setZone(timezone);
  const endIso = booking.endIso ? DateTime.fromISO(booking.endIso).setZone(timezone) : null;
  const startTimeStr = startIso.isValid ? startIso.toFormat('h:mm a') : '--:--';
  const endTimeStr = endIso?.isValid ? endIso.toFormat('h:mm a') : null;
  const startDateStr = startIso.isValid ? startIso.toFormat('EEE, MMM d') : '';
  const timeRangeLabel = endTimeStr ? `${startTimeStr}–${endTimeStr}` : startTimeStr;

  const timeUrgency = useMemo(() => {
    if (!highlightUrgency || !isUpcoming || !startIso.isValid) return null;
    const bookingDate = startIso.toISODate();
    const todayDate = now.toISODate();
    if (bookingDate !== todayDate) return null;

    const diffMinutes = startIso.diff(now, 'minutes').minutes;

    if (diffMinutes <= -15) {
      return { type: 'late' as const, label: `${Math.abs(Math.round(diffMinutes))} min late` };
    }
    if (diffMinutes <= 0 && diffMinutes > -15) {
      return { type: 'overdue' as const, label: 'Past time' };
    }
    if (diffMinutes <= 10 && diffMinutes > 0) {
      return { type: 'soon' as const, label: `${Math.round(diffMinutes)} min` };
    }
    if (diffMinutes <= 30 && diffMinutes > 0) {
      return { type: 'approaching' as const, label: `${Math.round(diffMinutes)} min` };
    }
    return null;
  }, [highlightUrgency, isUpcoming, startIso, now]);

  const guestInitials = (booking.customerName || 'Guest')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleMainAction = async () => {
    if (!isSeated && onCheckIn) await onCheckIn(booking.id);
    if (isSeated && onCheckOut) await onCheckOut(booking.id);
  };

  const cardBgClass = useMemo(() => {
    if (isDone) return 'border-border/60 bg-muted/40';
    if (timeUrgency?.type === 'late') return 'border-destructive/40 bg-destructive/5';
    if (timeUrgency?.type === 'overdue') return 'border-amber-500/40 bg-amber-500/5';
    if (timeUrgency?.type === 'soon') return 'border-amber-500/20 bg-amber-500/5';
    return 'border-border/60 bg-card/60 hover:bg-card hover:shadow-md';
  }, [isDone, timeUrgency]);

  return (
    <Card
      className={cn(
        'group relative grid gap-3 rounded-xl p-3 transition-all',
        'md:grid-cols-[1fr_220px] md:items-start',
        cardBgClass,
        isLoading && 'pointer-events-none opacity-60',
      )}
      data-booking-id={booking.id}
      aria-busy={isLoading}
    >
      {isLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/50 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 shadow-lg">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs font-medium text-foreground">Processing…</span>
          </div>
        </div>
      ) : null}

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Avatar className={cn(isDone ? 'bg-muted' : 'bg-primary/10')}>
                <AvatarFallback className={cn('text-xs font-bold', isDone ? 'text-muted-foreground' : 'text-primary')}>
                  {guestInitials || '—'}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      'truncate text-[15px] font-semibold leading-tight',
                      isDone ? 'text-muted-foreground line-through decoration-border/60' : 'text-foreground',
                    )}
                    title={customerLabel}
                  >
                    {customerLabel}
                  </p>
                  {booking.loyaltyTier ? (
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  ) : null}
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">{startDateStr}</span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="font-mono">{timeRangeLabel}</span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    {booking.partySize}
                  </span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="font-mono">Ref {referenceLabel}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <StatusPill status={booking.status} />
            {timeUrgency ? (
              <Badge
                variant={timeUrgency.type === 'late' ? 'destructive' : 'secondary'}
                className={cn(
                  'h-5 gap-1 rounded-full px-1.5 py-0 text-[10px]',
                  timeUrgency.type === 'overdue' &&
                    'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
                  timeUrgency.type === 'soon' &&
                    'border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
                  timeUrgency.type === 'approaching' &&
                    'border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
                )}
              >
                <Clock className="h-3 w-3" aria-hidden />
                {timeUrgency.label}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-2">
            {tableLabel ? (
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Armchair className="h-4 w-4" aria-hidden />
                <span className="truncate">
                  Table <span className="font-semibold text-foreground/80">{tableLabel}</span>
                </span>
              </div>
            ) : booking.status === 'confirmed' || booking.status === 'PRIORITY_WAITLIST' ? (
              <div className="flex items-center gap-2 text-[13px] text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                <span className="font-medium">No table assigned</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Armchair className="h-4 w-4" aria-hidden />
                <span>No table</span>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-2">
            <div className="flex flex-col gap-1 text-[13px] text-muted-foreground">
              {emailLabel ? (
                <a
                  className="truncate hover:text-foreground"
                  href={`mailto:${emailLabel}`}
                  title={emailLabel}
                >
                  {emailLabel}
                </a>
              ) : (
                <span className="italic text-muted-foreground/70">No email</span>
              )}
              {phoneLabel ? (
                <a
                  className="truncate hover:text-foreground"
                  href={`tel:${phoneLabel.replace(/[^+\d]/g, '')}`}
                  title={phoneLabel}
                >
                  {phoneLabel}
                </a>
              ) : (
                <span className="italic text-muted-foreground/70">No phone</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {booking.requiresTableAssignment ? (
            <Badge variant="outline" className="h-5 rounded-full px-2 py-0 text-[10px]">
              Needs table
            </Badge>
          ) : null}

          {booking.seatingPreference ? (
            <Badge variant="secondary" className="h-5 max-w-[220px] gap-1 rounded-full px-2 py-0 text-[10px]" title={booking.seatingPreference}>
              <Armchair className="h-3 w-3" aria-hidden />
              <span className="truncate">{booking.seatingPreference}</span>
            </Badge>
          ) : null}

          {booking.dietaryRestrictions && booking.dietaryRestrictions.length > 0 ? (
            <Badge
              variant="outline"
              className="h-5 max-w-[220px] gap-1 rounded-full px-2 py-0 text-[10px]"
              title={booking.dietaryRestrictions.join(', ')}
            >
              <Utensils className="h-3 w-3" aria-hidden />
              <span className="truncate">{booking.dietaryRestrictions.join(', ')}</span>
            </Badge>
          ) : null}

          {booking.allergies && booking.allergies.length > 0 ? (
            <Badge
              variant="destructive"
              className="h-5 max-w-[220px] gap-1 rounded-full px-2 py-0 text-[10px]"
              title={booking.allergies.join(', ')}
            >
              <AlertTriangle className="h-3 w-3" aria-hidden />
              <span className="truncate">{booking.allergies.join(', ')}</span>
            </Badge>
          ) : null}

          {booking.notes ? (
            <Badge
              variant="secondary"
              className="h-5 max-w-[320px] gap-1 rounded-full px-2 py-0 text-[10px]"
              title={booking.notes}
            >
              <FileText className="h-3 w-3" aria-hidden />
              <span className="truncate">{booking.notes}</span>
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 md:items-end">
        {!isDone ? (
          <>
            {(onCheckIn && !isSeated) || (onCheckOut && isSeated) ? (
              <Button
                size="sm"
                className="h-9 w-full justify-center md:w-auto"
                variant={isSeated ? 'outline' : 'default'}
                onClick={handleMainAction}
                disabled={isLoading || isPastBooking}
              >
                {isSeated ? <LogOut className="mr-2 h-3.5 w-3.5" /> : <LogIn className="mr-2 h-3.5 w-3.5" />}
                {isSeated ? 'Finish' : 'Seat'}
              </Button>
            ) : null}

            <div className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-end">
              <div className="flex items-center gap-1">
                {!isSeated && onMarkNoShow ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onMarkNoShow(booking.id)}
                    aria-label="Mark as no-show"
                    title="Mark as no-show"
                    disabled={isLoading || isPastBooking}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </div>

              <div className="flex items-center gap-1">
                {onDetails ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 px-3"
                    onClick={() => onDetails(booking)}
                    disabled={isLoading}
                  >
                    Details
                  </Button>
                ) : null}
              </div>
            </div>

            {onEdit || onCancel ? (
              <div className="flex w-full items-center justify-end gap-1 md:w-auto">
                {onEdit ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(booking)}
                    disabled={isLoading || isPastBooking}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Edit
                  </Button>
                ) : null}
                {onCancel ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCancel(booking)}
                    disabled={isLoading || isPastBooking}
                    className="h-8 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-full cursor-default justify-center text-muted-foreground hover:bg-transparent md:w-auto"
            disabled
          >
            <Check className="mr-2 h-3.5 w-3.5" aria-hidden />
            {booking.status === 'completed' ? 'Completed' : 'Closed'}
          </Button>
        )}
      </div>
    </Card>
  );
}
