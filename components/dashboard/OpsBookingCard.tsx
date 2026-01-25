'use client';

import {
  AlertTriangle,
  Armchair,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  FileText,
  LogIn,
  LogOut,
  Mail,
  MoreHorizontal,
  Phone,
  Sparkles,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { StatusBadge } from '@/components/features/dashboard/StatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import type { BookingDTO } from '@/hooks/useBookings';

export type OpsBookingCardProps = {
  booking: BookingDTO;
  timezone: string;
  now?: Date;
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
  actionsDisabled?: boolean;
  allowTableAssignments?: boolean;
  timeLabelOverride?: string | null;
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

const InfoTile = ({
  label,
  children,
  icon: Icon,
  className,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
}) => (
  <div
    className={cn(
      'flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5',
      className,
    )}
  >
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </div>
    <div className="text-[13px] leading-snug">{children}</div>
  </div>
);

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
  actionsDisabled,
  timeLabelOverride,
  highlightUrgency = true,
}: OpsBookingCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasAutoExpanded = useRef(false);
  const hasUserToggled = useRef(false);
  const now = useMemo(() => (propNow ? new Date(propNow) : new Date()), [propNow]);

  const meta = useMemo(() => {
    const startDate = new Date(booking.startIso);
    const endDate = booking.endIso ? new Date(booking.endIso) : null;

    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    });
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: timezone,
    });

    const startTimeStr = timeFormatter.format(startDate);
    const endTimeStr = endDate ? timeFormatter.format(endDate) : null;

    const getZonedDay = (d: Date) =>
      new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: timezone,
      }).format(d);

    const isToday = getZonedDay(startDate) === getZonedDay(now);

    const zonedStartOfDay = (d: Date) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: timezone,
      }).formatToParts(d);
      const year = parseInt(parts.find((p) => p.type === 'year')?.value || '0');
      const month = parseInt(parts.find((p) => p.type === 'month')?.value || '0') - 1;
      const day = parseInt(parts.find((p) => p.type === 'day')?.value || '0');
      return new Date(year, month, day).getTime();
    };

    const isPastDay = zonedStartOfDay(startDate) < zonedStartOfDay(now);

    const isDone = ['completed', 'cancelled', 'no_show'].includes(booking.status);
    const isSeated = booking.status === 'checked_in';

    return {
      startDate,
      isToday,
      isPastDay,
      isDone,
      isSeated,
      dateLabel: dateFormatter.format(startDate),
      timeRangeLabel: timeLabelOverride ?? (endTimeStr ? `${startTimeStr} – ${endTimeStr}` : startTimeStr),
      customerLabel: booking.customerName?.trim() || 'Walk-in Guest',
      initials: (booking.customerName || 'Guest')
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
    };
  }, [booking, now, timeLabelOverride, timezone]);

  const urgency = useMemo(() => {
    if (!highlightUrgency || meta.isDone || !meta.isToday) return null;
    const diffMinutes = Math.floor((meta.startDate.getTime() - now.getTime()) / 60000);

    if (diffMinutes <= -15)
      return { variant: 'destructive', label: `${Math.abs(diffMinutes)}m late` };
    if (diffMinutes <= 0) return { variant: 'warning', label: 'Overdue' };
    if (diffMinutes <= 20) return { variant: 'warning', label: `In ${diffMinutes}m` };
    return null;
  }, [highlightUrgency, meta, now]);

  const shouldAutoExpand = urgency?.variant === 'destructive' || urgency?.label === 'Overdue';

  useEffect(() => {
    hasAutoExpanded.current = false;
    hasUserToggled.current = false;
  }, [booking.id]);

  useEffect(() => {
    if (
      !shouldAutoExpand ||
      isOpen ||
      hasAutoExpanded.current ||
      hasUserToggled.current ||
      typeof window === 'undefined'
    ) {
      return;
    }
    if (window.matchMedia('(max-width: 639px)').matches) {
      setIsOpen(true);
      hasAutoExpanded.current = true;
    }
  }, [shouldAutoExpand, isOpen]);

  const handleOpenChange = (open: boolean) => {
    hasUserToggled.current = true;
    setIsOpen(open);
  };

  const isLoading = Boolean(pendingAction);
  const isLocked = Boolean(actionsDisabled);
  const disableActions = isLoading || isLocked;
  const tableLabel = getTableLabel(booking.tableAssignments);

  const railClass = useMemo(() => {
    if (meta.isDone) return 'border-l-slate-300';
    if (meta.isSeated) return 'border-l-emerald-500';
    if (urgency?.variant === 'destructive') return 'border-l-rose-500';
    if (urgency?.variant === 'warning') return 'border-l-amber-500';
    return 'border-l-blue-600';
  }, [meta, urgency]);

  return (
    <Card
      className={cn(
        'group relative overflow-hidden border-l-4 transition-[transform,box-shadow,opacity] duration-200 ease-out motion-reduce:transition-none',
        railClass,
        meta.isDone ? 'opacity-75' : 'hover:shadow-md motion-safe:hover:-translate-y-0.5',
        (isLoading || isLocked) && 'pointer-events-none opacity-60',
      )}
      role="article"
      aria-disabled={isLoading || isLocked}
      aria-labelledby={`guest-name-${booking.id}`}
    >
      <Collapsible open={isOpen} onOpenChange={handleOpenChange} className="w-full">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/45 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
            <div className="flex items-center gap-2 rounded-full border bg-white px-4 py-2 shadow-md">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span className="text-xs font-bold uppercase tracking-tighter text-slate-600">
                Updating
              </span>
            </div>
          </div>
        )}

        <div className="p-3 pb-2 sm:p-4 sm:pb-4">
          <div className="mb-2 sm:mb-4 flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <Avatar>
                <AvatarFallback
                  className={cn(
                    'font-bold text-sm',
                    meta.isDone ? 'bg-slate-100' : 'bg-blue-50 text-blue-600',
                  )}
                >
                  {meta.initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      'text-[15px] font-semibold leading-tight break-words',
                      meta.isDone
                        ? 'text-muted-foreground line-through decoration-border/60'
                        : 'text-foreground',
                    )}
                    title={meta.customerLabel}
                  >
                    {meta.customerLabel}
                  </p>
                  {booking.loyaltyTier ? (
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
                  ) : null}
                </div>
                <div className="mt-1 flex flex-col gap-1 text-xs font-medium text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1.5 sm:text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:contents">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>{booking.partySize} Guests</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>{meta.dateLabel}</span>
                    </span>
                  </div>
                  <div className="flex items-center sm:contents">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                      <Clock className="h-3 w-3" aria-hidden />
                      {meta.timeRangeLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-2">
                <StatusBadge status={booking.status} />
                <CollapsibleTrigger asChild className="sm:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 rounded-full transition-colors duration-150 hover:bg-slate-100 motion-reduce:transition-none"
                  disabled={disableActions}
                >
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-slate-400 transition-transform duration-150 ease-out motion-reduce:transition-none',
                        isOpen && 'rotate-180',
                      )}
                    />
                    <span className="sr-only">Toggle details</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
              {urgency && (
                <Badge
                  variant={urgency.variant === 'destructive' ? 'destructive' : 'outline'}
                  className={cn(
                    'py-0.5 text-[9px] uppercase tracking-wider',
                    urgency.variant === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700',
                  )}
                >
                  <Clock className="mr-1 h-3 w-3" aria-hidden /> {urgency.label}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <CollapsibleContent
          forceMount
          className="px-4 data-[state=closed]:hidden sm:data-[state=closed]:block sm:block"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 pb-4">
            <InfoTile label="Table" icon={Armchair}>
              {tableLabel ? (
                <span className="font-bold text-slate-900">Table {tableLabel}</span>
              ) : meta.isDone ? (
                <span className="text-slate-400 italic">N/A</span>
              ) : (
                <span className="flex items-center gap-1 font-bold text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Unassigned
                </span>
              )}
            </InfoTile>

            <InfoTile label="Contact" icon={Mail}>
              <div className="flex flex-col gap-1 leading-tight overflow-hidden">
                {booking.customerPhone && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-slate-700 break-words">
                    <Phone className="h-2.5 w-2.5 shrink-0" aria-hidden /> {booking.customerPhone}
                  </span>
                )}
                {booking.customerEmail && (
                  <span
                    className="text-[11px] italic text-slate-500 opacity-70 break-all leading-[1.1]"
                    title={booking.customerEmail}
                  >
                    {booking.customerEmail}
                  </span>
                )}
                {!booking.customerPhone && !booking.customerEmail && (
                  <span className="text-xs italic text-slate-400">No contact</span>
                )}
              </div>
            </InfoTile>

            <InfoTile label="Booking" icon={Users}>
              <div className="flex flex-col">
                <span className="font-mono text-[11px] text-slate-500">
                  Ref {booking.reference || booking.id.slice(0, 8)}
                </span>
              </div>
            </InfoTile>

            <InfoTile
              label="Notes"
              icon={FileText}
              className={cn(booking.notes && 'border-amber-100 bg-amber-50/50')}
            >
              <p className="text-xs italic text-slate-500 break-words">
                {booking.notes || 'No special requests.'}
              </p>
            </InfoTile>
          </div>
        </CollapsibleContent>

        <div className="px-4 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-y-3 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-4 text-xs font-semibold"
                onClick={() => onDetails?.(booking)}
                disabled={disableActions}
              >
                Details
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label="More actions"
                    disabled={disableActions}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                    Manage
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onEdit?.(booking)}
                    disabled={disableActions || meta.isPastDay}
                  >
                    Edit Booking
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onMarkNoShow?.(booking.id)}
                    disabled={disableActions || !meta.isToday || meta.isSeated}
                    variant="destructive"
                  >
                    Mark No Show
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onCancel?.(booking)}
                    disabled={disableActions || meta.isPastDay}
                    variant="destructive"
                  >
                    Cancel Booking
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div>
              {!meta.isDone ? (
                <Button
                  size="sm"
                  disabled={!meta.isToday || disableActions}
                  className={cn(
                    'h-9 min-w-[120px] px-6 font-bold text-white shadow-sm transition-[transform,box-shadow,background-color] duration-150 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 hover:shadow-md motion-reduce:transition-none',
                    meta.isSeated
                      ? 'bg-slate-800 hover:bg-slate-900'
                      : 'bg-emerald-600 hover:bg-emerald-700',
                  )}
                  onClick={() =>
                    meta.isSeated ? onCheckOut?.(booking.id) : onCheckIn?.(booking.id)
                  }
                >
                  {meta.isSeated ? (
                    <>
                      <LogOut className="mr-2 h-4 w-4" aria-hidden /> Finish
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" aria-hidden /> Seat Guest
                    </>
                  )}
                </Button>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-3 text-xs font-bold text-slate-400"
                  role="status"
                >
                  <Check className="h-4 w-4 text-emerald-500" aria-hidden />
                  {booking.status === 'completed' ? 'Completed' : 'Closed'}
                </div>
              )}
            </div>
          </div>
        </div>
      </Collapsible>
    </Card>
  );
}
