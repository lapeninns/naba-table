/**
 * BookingDialog
 *
 * Usage:
 * <BookingDialog
 *   booking={booking}
 *   summary={summary}
 *   allowTableAssignments
 *   onCheckIn={...}
 *   onCheckOut={...}
 *   onMarkNoShow={...}
 *   onUndoNoShow={...}
 *   open={open}
 *   onOpenChange={setOpen}
 * />
 */

'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  LayoutGrid,
  LogIn,
  LogOut,
  Mail,
  Phone,
  RotateCcw,
  Star,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';

import { BookingAssignmentTabContent } from './BookingAssignmentTabContent';
import {
  ArrivalCountdown,
  BookingStatusBadge,
  ClickToCopy,
} from './components';
import {
  calculateCapacityPercent,
  calculateTotalCapacity,
  canCheckIn,
  canMarkNoShow,
  copyToClipboard,
  flattenTableAssignments,
  formatBookingDate,
  formatBookingTime,
  formatPhoneForTel,
  getGuestInitials,
  getMinutesUntilTime,
  getStatusConfig,
  parseBookingDateTime,
} from './utils';

import type { BookingActionType, BookingDialogProps } from './types';
import type { LucideIcon } from 'lucide-react';

type PrimaryAction =
  | { id: 'assign-table'; label: string; icon: LucideIcon; tone: string; onClick: () => void }
  | { id: BookingActionType; label: string; icon: LucideIcon; tone: string; onClick: () => void }
  | null;

export function BookingDialog({
  booking,
  summary,
  allowTableAssignments,
  isLoading = false,
  errorMessage = null,
  onRetry,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  onUndoNoShow,
  pendingLifecycleAction,
  open,
  onOpenChange,
}: BookingDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [isOpen, setIsOpen] = useState(Boolean(open));
  const [pendingAction, setPendingAction] = useState<BookingActionType | null>(null);
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      setIsOpen(value);
      onOpenChange?.(value);
    },
    [onOpenChange],
  );

  const timezone = summary?.timezone ?? 'UTC';
  const bookingDate = summary?.date ?? null;
  const status = booking?.status ?? 'pending';

  const formattedDate = bookingDate ? formatBookingDate(bookingDate, timezone) : '--';
  const formattedStartTime = booking ? formatBookingTime(booking.startTime, bookingDate, timezone) : '--:--';
  const formattedEndTime = booking ? formatBookingTime(booking.endTime, bookingDate, timezone) : '--:--';

  const titleText = booking?.customerName ? `Booking for ${booking.customerName}` : 'Booking details';
  const descriptionText = booking
    ? `${formattedDate} · ${formattedStartTime} · ${booking.partySize} covers`
    : 'Booking overview and table assignment';

  const startDateTime = booking && bookingDate
    ? parseBookingDateTime({ time: booking.startTime, date: bookingDate, timezone })
    : null;
  const endDateTime = booking && bookingDate
    ? parseBookingDateTime({ time: booking.endTime, date: bookingDate, timezone })
    : null;
  const durationMinutes =
    startDateTime && endDateTime
      ? Math.max(0, Math.round(endDateTime.diff(startDateTime, 'minutes').minutes ?? 0))
      : null;

  const minutesRemaining =
    booking && bookingDate ? getMinutesUntilTime(booking.startTime, bookingDate, timezone) : null;

  const assignedTableRows = useMemo(
    () => (booking ? flattenTableAssignments(booking.tableAssignments) : []),
    [booking],
  );
  const totalCapacity = calculateTotalCapacity(assignedTableRows);
  const capacityPercent = booking ? calculateCapacityPercent(totalCapacity, booking.partySize) : 0;

  const shouldShowNoShow = booking ? canMarkNoShow(booking.status) && Boolean(onMarkNoShow) : false;
  const canUndoNoShow = booking?.status === 'no_show';
  const canCheckOut = booking?.status === 'checked_in';

  const needsAssignment =
    Boolean(booking?.requiresTableAssignment) && allowTableAssignments && assignedTableRows.length === 0;

  const isActionPending = Boolean(pendingLifecycleAction || pendingAction);

  const handleAction = useCallback(
    async (action: BookingActionType) => {
      if (!action) return;
      setPendingAction(action);
      try {
        if (action === 'check-in') {
          await onCheckIn?.();
        } else if (action === 'check-out') {
          await onCheckOut?.();
        } else if (action === 'undo-no-show') {
          await onUndoNoShow?.();
        } else if (action === 'no-show') {
          await onMarkNoShow?.();
        }
        if (booking?.id) {
          queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(booking.id) });
        }
      } finally {
        setPendingAction(null);
      }
    },
    [booking?.id, onCheckIn, onCheckOut, onMarkNoShow, onUndoNoShow, queryClient],
  );

  const handleCopySummary = useCallback(async () => {
    if (!booking || !summary) return;
    const statusLabel = getStatusConfig(booking.status).label;
    const tableLabel = assignedTableRows.length
      ? assignedTableRows.map((member) => member.tableNumber).join(', ')
      : 'Unassigned';
    const summaryText = [
      `Booking: ${booking.customerName}`,
      `Covers: ${booking.partySize}`,
      `Time: ${formattedDate} ${formattedStartTime}${booking.endTime ? ` - ${formattedEndTime}` : ''}`,
      `Status: ${statusLabel}`,
      `Reference: ${booking.reference ?? booking.id}`,
      `Tables: ${tableLabel}`,
      booking.customerPhone ? `Phone: ${booking.customerPhone}` : null,
      booking.customerEmail ? `Email: ${booking.customerEmail}` : null,
      booking.notes ? `Notes: ${booking.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const success = await copyToClipboard(summaryText);
    toast({
      title: success ? 'Summary copied' : 'Copy failed',
      description: success ? 'Booking summary copied to clipboard.' : 'Please try again.',
      variant: success ? 'default' : 'destructive',
      duration: 2000,
    });
  }, [
    assignedTableRows,
    booking,
    formattedDate,
    formattedEndTime,
    formattedStartTime,
    summary,
    toast,
  ]);

  const primaryAction: PrimaryAction = useMemo(() => {
    if (!booking) return null;

    if (needsAssignment) {
      return {
        id: 'assign-table',
        label: 'Assign table',
        icon: LayoutGrid,
        tone: 'bg-indigo-600 hover:bg-indigo-700',
        onClick: () => {
          if (isMobile) setActiveTab('tables');
        },
      };
    }

    if (canCheckOut && onCheckOut) {
      return {
        id: 'check-out',
        label: 'Complete visit',
        icon: LogOut,
        tone: 'bg-blue-600 hover:bg-blue-700',
        onClick: () => handleAction('check-out'),
      };
    }

    if (canUndoNoShow && onUndoNoShow) {
      return {
        id: 'undo-no-show',
        label: 'Undo no-show',
        icon: RotateCcw,
        tone: 'bg-orange-600 hover:bg-orange-700',
        onClick: () => handleAction('undo-no-show'),
      };
    }

    if (canCheckIn(booking.status) && onCheckIn) {
      return {
        id: 'check-in',
        label: 'Mark arrived',
        icon: LogIn,
        tone: 'bg-emerald-600 hover:bg-emerald-700',
        onClick: () => handleAction('check-in'),
      };
    }

    return null;
  }, [booking, canCheckOut, canUndoNoShow, handleAction, isMobile, needsAssignment, onCheckIn, onCheckOut, onUndoNoShow]);

  const HeaderContent = () => (
    <div className="grid grid-cols-[1fr_auto] gap-3">
      {/* Left: Guest info + Status */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar */}
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
          {booking ? getGuestInitials(booking.customerName) : '--'}
        </div>

        {/* Guest details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-foreground truncate">
              {booking?.customerName ?? 'Booking details'}
            </span>
            <BookingStatusBadge status={status} />
          </div>
          {/* Mobile only: show key info */}
          <div className="flex sm:hidden items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <span>{formattedDate}</span>
            <span>·</span>
            <span>{formattedStartTime}</span>
            <span>·</span>
            <span>{booking?.partySize ?? '--'} covers</span>
          </div>
        </div>
      </div>

      {/* Right: Quick stats + Close button */}
      <div className="flex items-center gap-2">
        {/* Stats chips - hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1.5">
          {/* Date chip */}
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-medium">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </div>
          {/* Time chip */}
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
            <Clock className="h-3 w-3" />
            {formattedStartTime}
          </div>
          {/* Covers chip */}
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
            <Users className="h-3 w-3" />
            {booking?.partySize ?? '--'}
          </div>
          {/* Countdown chip */}
          {minutesRemaining !== null && (
            <ArrivalCountdown status={status} startTime={booking?.startTime ?? null} date={bookingDate} timezone={timezone} />
          )}
        </div>

        {/* Reference chip */}
        {booking?.reference || booking?.id ? (
          <ClickToCopy text={booking.reference ?? booking.id} label="Ref" compact />
        ) : null}

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleOpenChange(false)}
          className="h-8 w-8 rounded-full"
          aria-label="Close booking details"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderOverview = () => {
    if (!booking || !summary) return null;

    const sourceLabel = booking.source ? booking.source : 'Direct';
    const occasionLabel = booking.details && typeof booking.details['occasion'] === 'string'
      ? String(booking.details['occasion'])
      : 'Standard';
    const depositValue =
      booking.details?.['deposit'] ??
      booking.details?.['depositAmount'] ??
      booking.details?.['prepay'] ??
      booking.details?.['prepayAmount'] ??
      booking.details?.['prepaidAmount'];
    const depositLabel =
      typeof depositValue === 'number' || typeof depositValue === 'string'
        ? `£${depositValue}`
        : 'None';

    // Status timeline data
    const statusTimeline = [
      {
        status: 'created',
        label: 'Booked',
        done: true,
        icon: Calendar,
      },
      {
        status: 'confirmed',
        label: 'Confirmed',
        done: ['confirmed', 'checked_in', 'completed'].includes(status),
        icon: CheckCircle2,
      },
      {
        status: 'checked_in',
        label: 'Checked In',
        done: ['checked_in', 'completed'].includes(status),
        time: booking.checkedInAt ? DateTime.fromISO(booking.checkedInAt, { zone: timezone }).toFormat('HH:mm') : null,
        icon: LogIn,
      },
      {
        status: 'completed',
        label: 'Completed',
        done: status === 'completed',
        time: booking.checkedOutAt ? DateTime.fromISO(booking.checkedOutAt, { zone: timezone }).toFormat('HH:mm') : null,
        icon: LogOut,
      },
    ];

    const hasSeatingPreference = Boolean(booking.seatingPreference);

    // Get loyalty tier gradient
    const getLoyaltyGradient = (tier: string | null) => {
      switch (tier) {
        case 'platinum':
          return 'from-purple-500 to-violet-600';
        case 'gold':
          return 'from-amber-500 to-orange-500';
        case 'silver':
          return 'from-slate-400 to-slate-500';
        case 'bronze':
          return 'from-orange-400 to-amber-600';
        default:
          return 'from-slate-300 to-slate-400';
      }
    };

    return (
      <div className="space-y-4">
        {/* 🎨 Guest Profile Hero Card - Premium Design */}
        <Card className="overflow-hidden border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-white via-slate-50/30 to-slate-100/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 mb-3">
              {/* Avatar with loyalty gradient */}
              <div className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md",
                booking.loyaltyTier
                  ? `bg-gradient-to-br ${getLoyaltyGradient(booking.loyaltyTier)}`
                  : 'bg-gradient-to-br from-indigo-500 to-purple-600'
              )}>
                {getGuestInitials(booking.customerName)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                    {booking.customerName}
                  </h3>
                  {booking.loyaltyTier && (
                    <Badge className={cn(
                      'text-[10px] font-semibold tracking-wide uppercase shadow-sm',
                      booking.loyaltyTier === 'platinum' && 'bg-gradient-to-r from-purple-500 to-violet-600 border-purple-400',
                      booking.loyaltyTier === 'gold' && 'bg-gradient-to-r from-amber-500 to-orange-500 border-amber-400',
                      booking.loyaltyTier === 'silver' && 'bg-gradient-to-r from-slate-400 to-slate-500 border-slate-300',
                      booking.loyaltyTier === 'bronze' && 'bg-gradient-to-r from-orange-400 to-amber-600 border-orange-400',
                    )}>
                      {booking.loyaltyTier}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                  {booking.loyaltyPoints ? (
                    <>
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      <span className="font-medium">{booking.loyaltyPoints} points</span>
                    </>
                  ) : (
                    <span>New guest</span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Contact Actions */}
            <div className="grid grid-cols-2 gap-2">
              {booking.customerPhone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 hover:from-emerald-100 hover:to-teal-100 hover:border-emerald-300 text-emerald-700 shadow-sm transition-all"
                  asChild
                >
                  <a href={`tel:${formatPhoneForTel(booking.customerPhone)}`}>
                    <Phone className="h-3.5 w-3.5 mr-1.5" />
                    Call
                  </a>
                </Button>
              )}
              {booking.customerEmail && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 text-blue-700 shadow-sm transition-all"
                  asChild
                >
                  <a href={`mailto:${booking.customerEmail}`}>
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                    Email
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 📊 Booking Vitals - 2x2 Premium Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Covers */}
          <Card className="group hover:shadow-md transition-all duration-200 border-slate-200/60 bg-gradient-to-br from-white to-indigo-50/30">
            <CardContent className="p-3">
              <div className="flex flex-col gap-2">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-200/50 group-hover:scale-110 transition-transform">
                  <Users className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 tracking-tight">{booking.partySize}</div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Covers</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Window */}
          <Card className="group hover:shadow-md transition-all duration-200 border-amber-200/60 bg-gradient-to-br from-white to-amber-50/30">
            <CardContent className="p-3">
              <div className="flex flex-col gap-2">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md shadow-amber-200/50 group-hover:scale-110 transition-transform">
                  <Clock className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 leading-tight">{formattedStartTime}</div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    {durationMinutes ? `${durationMinutes} min` : 'Duration TBC'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Source */}
          <Card className="group hover:shadow-md transition-all duration-200 border-slate-200/60 bg-gradient-to-br from-white to-slate-50/50">
            <CardContent className="p-2.5">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center shadow-sm">
                  <Star className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 truncate">{sourceLabel}</div>
                  <div className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Source</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Occasion */}
          <Card className="group hover:shadow-md transition-all duration-200 border-slate-200/60 bg-gradient-to-br from-white to-slate-50/50">
            <CardContent className="p-2.5">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-sm">
                  <Calendar className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 truncate">{occasionLabel}</div>
                  <div className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Occasion</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ⏱️ Arrival Countdown Banner (if applicable) */}
        {minutesRemaining !== null && minutesRemaining > -120 && (
          <Card className={cn(
            "border-2 overflow-hidden",
            minutesRemaining > 0 && minutesRemaining <= 30
              ? "border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50"
              : minutesRemaining > 30
                ? "border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50"
                : "border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100"
          )}>
            <CardContent className="p-3">
              <ArrivalCountdown
                status={status}
                startTime={booking.startTime}
                date={bookingDate}
                timezone={timezone}
              />
            </CardContent>
          </Card>
        )}

        {/* 🪑 Table Assignment Card */}
        {assignedTableRows.length > 0 ? (
          <Card className="border-slate-200/60 shadow-sm">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned Tables</span>
                <div className="flex gap-1">
                  {assignedTableRows.map((member) => (
                    <Badge key={member.id} variant="secondary" className="text-xs font-semibold">
                      {member.tableNumber}
                    </Badge>
                  ))}
                </div>
              </div>
              <Progress value={capacityPercent} className="h-2 bg-slate-100" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Capacity</span>
                <span className={cn(
                  "font-bold",
                  capacityPercent >= 100 ? "text-emerald-600" : capacityPercent >= 80 ? "text-amber-600" : "text-slate-600"
                )}>
                  {totalCapacity} / {booking.partySize} seats
                </span>
              </div>
              {hasSeatingPreference && (
                <Badge variant="outline" className="mt-1 text-xs border-indigo-200 bg-indigo-50 text-indigo-700">
                  {booking.seatingPreference}
                </Badge>
              )}
            </CardContent>
          </Card>
        ) : (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTitle className="text-amber-900">No table assigned</AlertTitle>
            <AlertDescription className="text-amber-700">
              Assign a table to complete the seating plan.
            </AlertDescription>
          </Alert>
        )}

        {/* 📋 Journey Timeline - Vertical */}
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
              Journey Timeline
            </div>
            <div className="space-y-3">
              {statusTimeline.map((step, index) => {
                const StepIcon = step.icon;
                return (
                  <div key={step.status} className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300',
                        step.done
                          ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md shadow-emerald-200/50'
                          : 'bg-slate-100 text-slate-400'
                      )}>
                        <StepIcon className="h-4 w-4" />
                      </div>
                      {index < statusTimeline.length - 1 && (
                        <div className={cn(
                          'w-0.5 h-6 transition-all duration-300',
                          step.done ? 'bg-gradient-to-b from-emerald-400 to-emerald-200' : 'bg-slate-200'
                        )} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        'text-sm font-medium transition-colors',
                        step.done ? 'text-slate-900' : 'text-slate-400'
                      )}>
                        {step.label}
                      </div>
                      {step.time && (
                        <div className="text-xs text-emerald-600 font-medium">{step.time}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 💬 Notes & Special Requests */}
        {(booking.notes || booking.profileNotes) && (
          <Card className="border-slate-200/60 bg-gradient-to-br from-white to-slate-50/30">
            <CardContent className="p-3">
              <Accordion type="single" collapsible defaultValue={booking.notes ? 'notes' : undefined}>
                <AccordionItem value="notes" className="border-none">
                  <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:no-underline py-2">
                    Notes & Requests
                  </AccordionTrigger>
                  <AccordionContent>
                    {booking.notes ? (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-700 bg-white rounded-lg p-3 border border-slate-200 italic">
                          &ldquo;{booking.notes}&rdquo;
                        </div>
                        <ClickToCopy text={booking.notes} label="Copy notes" compact />
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No notes recorded.</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
                {booking.profileNotes && (
                  <AccordionItem value="profile" className="border-none">
                    <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:no-underline py-2">
                      Guest Profile Notes
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="text-sm text-slate-700 bg-white rounded-lg p-3 border border-slate-200">
                        {booking.profileNotes}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* 💳 Deposit Info (if exists) */}
        {depositLabel !== 'None' && (
          <Card className="border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-teal-50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                    <CreditCard className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Deposit</div>
                    <div className="text-lg font-bold text-emerald-900">{depositLabel}</div>
                  </div>
                </div>
                <Badge className="bg-emerald-600 text-white shadow-sm">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Paid
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderContact = () => {
    if (!booking) return null;
    return (
      <div className="space-y-3">
        {/* Phone CTA Button */}
        {booking.customerPhone ? (
          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-3 h-12 rounded-2xl border border-emerald-200/70 bg-white/80 text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50/60 hover:border-emerald-300/70"
            asChild
          >
            <a href={`tel:${formatPhoneForTel(booking.customerPhone)}`}>
              <div className="h-8 w-8 rounded-full bg-emerald-100/80 ring-1 ring-inset ring-emerald-200/70 flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">Call Guest</span>
                <span className="text-xs text-emerald-600">{booking.customerPhone}</span>
              </div>
            </a>
          </Button>
        ) : (
          <Alert variant="default" className="border-stone-200/70 bg-white/70 text-stone-600">
            <Phone className="h-4 w-4" />
            <AlertTitle>No phone provided</AlertTitle>
            <AlertDescription>Phone number not available for this booking.</AlertDescription>
          </Alert>
        )}

        {/* Email CTA Button */}
        {booking.customerEmail ? (
          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-3 h-12 rounded-2xl border border-amber-200/70 bg-white/80 text-amber-900 shadow-sm transition-colors hover:bg-amber-50/60 hover:border-amber-300/70"
            asChild
          >
            <a href={`mailto:${booking.customerEmail}`}>
              <div className="h-8 w-8 rounded-full bg-amber-100/80 ring-1 ring-inset ring-amber-200/70 flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-amber-700" />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-sm font-medium">Email Guest</span>
                <span className="text-xs text-amber-700 truncate max-w-[200px]">{booking.customerEmail}</span>
              </div>
            </a>
          </Button>
        ) : null}
      </div>
    );
  };

  const renderTables = () => {
    if (!booking || !summary) return null;
    if (!allowTableAssignments) {
      return (
        <Alert>
          <AlertTitle>Table assignment disabled</AlertTitle>
          <AlertDescription>Assignments are locked for past bookings.</AlertDescription>
        </Alert>
      );
    }

    return (
      <BookingAssignmentTabContent
        booking={booking}
        restaurantId={summary.restaurantId}
        date={summary.date}
        onAssignmentComplete={() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(booking.id) });
        }}
      />
    );
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="space-y-4 p-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      );
    }

    if (errorMessage) {
      return (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertTitle>Unable to load booking</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{errorMessage}</span>
              {onRetry ? (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    if (!booking || !summary) {
      return (
        <div className="p-4">
          <Alert>
            <AlertTitle>No booking selected</AlertTitle>
            <AlertDescription>Select a booking to view details.</AlertDescription>
          </Alert>
        </div>
      );
    }

    if (isMobile) {
      return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
          <TabsList className="grid w-full grid-cols-3 rounded-none border-b bg-background">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="tables">Tables</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">{renderOverview()}</div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="contact" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">{renderContact()}</div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="tables" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">{renderTables()}</div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      );
    }

    return (
      <div className="grid h-full overflow-hidden grid-cols-1 lg:grid-cols-2">
        <ScrollArea className="h-full border-r border-stone-200/70 bg-gradient-to-b from-stone-50/80 via-white to-stone-50/60 overflow-x-hidden">
          <div className="p-5 lg:p-6 space-y-5 overflow-x-hidden">
            {renderOverview()}
            <Separator className="bg-stone-200/70" />
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                  Contact
                </span>
                <div className="h-px flex-1 bg-stone-200/70" />
              </div>
              {renderContact()}
            </div>
          </div>
        </ScrollArea>
        <ScrollArea className="h-full overflow-x-hidden">
          <div className="p-4 overflow-x-hidden">{renderTables()}</div>
        </ScrollArea>
      </div>
    );
  };

  const content = (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header - fixed height */}
      <div className="shrink-0 border-b bg-background px-4 py-3">
        <HeaderContent />
      </div>
      {/* Body - takes remaining space and scrolls */}
      <div className="flex-1 min-h-0 overflow-hidden">{renderBody()}</div>
      {/* Footer - fixed height */}
      <div className="shrink-0 border-t bg-background px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {booking ? `${formattedDate} · ${formattedStartTime}` : 'Booking details'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopySummary} disabled={!booking || !summary}>
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy summary
            </Button>
            {booking?.customerPhone ? (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${formatPhoneForTel(booking.customerPhone)}`}>
                  <Phone className="h-3.5 w-3.5 mr-1" />
                  Call guest
                </a>
              </Button>
            ) : null}
            {shouldShowNoShow && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmNoShow(true)}
                disabled={isActionPending}
                className="text-rose-600 hover:text-rose-700"
              >
                <UserX className="h-3.5 w-3.5 mr-1" />
                No-show
              </Button>
            )}
            {primaryAction ? (() => {
              const PrimaryIcon = primaryAction.icon;
              return (
                <Button
                  size="sm"
                  onClick={primaryAction.onClick}
                  disabled={isActionPending}
                  className={cn('text-white', primaryAction.tone)}
                >
                  <PrimaryIcon className="h-4 w-4 mr-1.5" />
                  {primaryAction.label}
                </Button>
              );
            })() : null}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={isOpen} onOpenChange={handleOpenChange}>
          <SheetContent
            side="bottom"
            className={cn('h-[92vh] p-0 gap-0 overflow-hidden [&>button]:hidden', 'rounded-t-2xl')}
          >
            <SheetTitle className="sr-only">{titleText}</SheetTitle>
            <SheetDescription className="sr-only">{descriptionText}</SheetDescription>
            {content}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogContent className="flex flex-col h-[70vh] max-w-5xl p-0 overflow-hidden [&>button]:hidden">
            <DialogTitle className="sr-only">{titleText}</DialogTitle>
            <DialogDescription className="sr-only">{descriptionText}</DialogDescription>
            {content}
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={confirmNoShow} onOpenChange={setConfirmNoShow}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as no-show?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the booking as a no-show. You can undo this later if the guest arrives.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction('no-show')}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Confirm no-show
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default BookingDialog;
