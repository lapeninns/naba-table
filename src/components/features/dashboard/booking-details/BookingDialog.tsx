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
  Ban,
  ChevronDown,
  Copy,
  LayoutGrid,
  LogIn,
  LogOut,
  Phone,
  RotateCcw,
  UserX,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';

import { DialogHeader, GuestProfilePanel, TableAssignmentPanel } from './components';
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
  getMinutesUntilTime,
  getStatusConfig,
} from './utils';

import type { BookingActionType, BookingDialogProps } from './types';
import type { OpsBookingStatus } from '@/types/ops';
import type { LucideIcon } from 'lucide-react';

type PrimaryAction =
  | { id: 'assign-table'; label: string; icon: LucideIcon; tone: string; onClick: () => void }
  | { id: BookingActionType; label: string; icon: LucideIcon; tone: string; onClick: () => void }
  | null;

const HEADER_TONES: Record<string, string> = {
  checked_in: 'border-l-4 border-emerald-500 bg-emerald-50/60',
  confirmed: 'border-l-4 border-blue-500 bg-blue-50/60',
  late: 'border-l-4 border-rose-500 bg-rose-50/60',
};

const getHeaderTone = (status: string) =>
  HEADER_TONES[status] ?? 'border-l-4 border-slate-200 bg-background';

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
  onCancel,
  pendingLifecycleAction,
  cancelPending,
  open,
  onOpenChange,
  isToday = true,
}: BookingDialogProps) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [isOpen, setIsOpen] = useState(Boolean(open));
  const [isTableAssignmentOpen, setIsTableAssignmentOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<BookingActionType | null>(null);
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const tablePanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);

  useEffect(() => {
    if (!isOpen) setIsTableAssignmentOpen(false);
  }, [isOpen]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      setIsOpen(value);
      onOpenChange?.(value);
    },
    [onOpenChange],
  );

  const timezone = summary?.timezone ?? 'UTC';
  const bookingDate = summary?.date ?? null;
  const status: OpsBookingStatus = booking?.status ?? 'pending';

  const formattedDate = bookingDate ? formatBookingDate(bookingDate, timezone) : '--';
  const formattedStartTime = booking
    ? formatBookingTime(booking.startTime, bookingDate, timezone)
    : '--:--';
  const formattedEndTime = booking
    ? formatBookingTime(booking.endTime, bookingDate, timezone)
    : '--:--';

  const titleText = booking?.customerName
    ? `Booking for ${booking.customerName}`
    : 'Booking details';
  const descriptionText = booking
    ? `${formattedDate} · ${formattedStartTime} · ${booking.partySize} covers`
    : 'Booking overview and table assignment';

  const minutesRemaining =
    booking && bookingDate ? getMinutesUntilTime(booking.startTime, bookingDate, timezone) : null;

  const headerStatus = useMemo(() => {
    if (status === 'confirmed' && minutesRemaining !== null && minutesRemaining < 0) return 'late';
    return status;
  }, [minutesRemaining, status]);
  const headerTone = getHeaderTone(headerStatus);

  const assignedTableRows = useMemo(
    () => (booking ? flattenTableAssignments(booking.tableAssignments) : []),
    [booking],
  );
  const totalCapacity = calculateTotalCapacity(assignedTableRows);
  const capacityPercent = booking ? calculateCapacityPercent(totalCapacity, booking.partySize) : 0;

  const shouldShowNoShow =
    booking && isToday ? canMarkNoShow(booking.status) && Boolean(onMarkNoShow) : false;
  const canUndoNoShow = booking?.status === 'no_show';
  const canCheckOut = booking?.status === 'checked_in';

  const needsAssignment =
    Boolean(booking?.requiresTableAssignment) &&
    allowTableAssignments &&
    assignedTableRows.length === 0;

  const isActionPending = Boolean(pendingLifecycleAction || pendingAction || cancelPending);
  const canCancel =
    Boolean(booking) && !['cancelled', 'completed', 'no_show', 'checked_in'].includes(status);

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

    await copyToClipboard(summaryText);
  }, [
    assignedTableRows,
    booking,
    formattedDate,
    formattedEndTime,
    formattedStartTime,
    summary,
  ]);

  const handleCancel = useCallback(async () => {
    if (!onCancel) return;
    try {
      await onCancel();
    } finally {
      setConfirmCancel(false);
    }
  }, [onCancel]);

  const primaryAction: PrimaryAction = useMemo(() => {
    if (!booking) return null;

    if (needsAssignment) {
      return {
        id: 'assign-table',
        label: 'Assign table',
        icon: LayoutGrid,
        tone: 'bg-indigo-600 hover:bg-indigo-700',
          onClick: () => {
            if (isMobile) {
              setIsTableAssignmentOpen(true);
              setTimeout(() => {
                tablePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 100);
            } else {
              tablePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
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

    if (isToday && canCheckIn(booking.status) && onCheckIn) {
      return {
        id: 'check-in',
        label: 'Mark arrived',
        icon: LogIn,
        tone: 'bg-emerald-600 hover:bg-emerald-700',
        onClick: () => handleAction('check-in'),
      };
    }

    return null;
  }, [
    booking,
    canCheckOut,
    canUndoNoShow,
    handleAction,
    isMobile,
    isToday,
    needsAssignment,
    onCheckIn,
    onCheckOut,
    onUndoNoShow,
  ]);

  useGlobalShortcuts([
    {
      key: 'enter',
      meta: true,
      ctrl: true,
      enabled: Boolean(isOpen && primaryAction),
      handler: () => {
        if (isOpen && primaryAction) primaryAction.onClick();
      },
    },
    {
      key: 'escape',
      enabled: isOpen,
      preventDefault: false,
      handler: () => {
        if (isOpen) handleOpenChange(false);
      },
    },
  ]);

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
        <ScrollArea className="h-full bg-slate-50/30">
          <div className="flex flex-col gap-6 p-4 pb-20">
            <GuestProfilePanel
              booking={booking}
              bookingDate={bookingDate}
              timezone={timezone}
              status={status}
              minutesRemaining={minutesRemaining}
              assignedTableRows={assignedTableRows}
              totalCapacity={totalCapacity}
              capacityPercent={capacityPercent}
            />

            <div ref={tablePanelRef} className="pt-4 border-t border-dashed border-slate-200">
              <Collapsible
                open={isTableAssignmentOpen}
                onOpenChange={setIsTableAssignmentOpen}
                className="space-y-3"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex w-full items-center justify-between p-0 hover:bg-transparent mb-4 h-auto hover:no-underline"
                  >
                    <div className="text-left">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1">
                        Table Assignment
                      </h3>
                      <p className="text-xs text-slate-500 font-normal">
                        Manage seating and capacity.
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-slate-500 transition-transform duration-200',
                        isTableAssignmentOpen && 'rotate-180',
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {isTableAssignmentOpen && (
                    <>
                      {allowTableAssignments ? (
                        <TableAssignmentPanel
                          bookingId={booking.id}
                          restaurantId={summary.restaurantId}
                          partySize={booking.partySize}
                          date={summary.date}
                          currentAssignments={assignedTableRows.map((row) => row.id)}
                          onAssignmentComplete={() => {
                            queryClient.invalidateQueries({
                              queryKey: queryKeys.opsBookings.detail(booking.id),
                            });
                          }}
                          bookingStartTime={booking.startTime}
                          bookingEndTime={booking.endTime}
                        />
                      ) : (
                        <Alert>
                          <AlertTitle>Table assignment disabled</AlertTitle>
                          <AlertDescription>
                            Assignments are locked for past bookings.
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </ScrollArea>
      );
    }

    return (
      <div className="grid h-full overflow-hidden grid-cols-1 lg:grid-cols-2">
        <ScrollArea className="h-full border-b border-stone-200/70 lg:border-b-0 lg:border-r bg-gradient-to-b from-stone-50/80 via-white to-stone-50/60 overflow-x-hidden">
          <div className="p-5 lg:p-6 space-y-5 overflow-x-hidden">
            <GuestProfilePanel
              booking={booking}
              bookingDate={bookingDate}
              timezone={timezone}
              status={status}
              minutesRemaining={minutesRemaining}
              assignedTableRows={assignedTableRows}
              totalCapacity={totalCapacity}
              capacityPercent={capacityPercent}
            />
          </div>
        </ScrollArea>
        <ScrollArea className="h-full overflow-x-hidden bg-white">
          <div ref={tablePanelRef} className="p-4 lg:p-6 overflow-x-hidden h-full">
            <div className="mb-4 lg:hidden">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Table Assignment
              </h3>
            </div>
            {allowTableAssignments ? (
              <TableAssignmentPanel
                bookingId={booking.id}
                restaurantId={summary.restaurantId}
                partySize={booking.partySize}
                date={summary.date}
                currentAssignments={assignedTableRows.map((row) => row.id)}
                onAssignmentComplete={() => {
                  queryClient.invalidateQueries({
                    queryKey: queryKeys.opsBookings.detail(booking.id),
                  });
                }}
                bookingStartTime={booking.startTime}
                bookingEndTime={booking.endTime}
              />
            ) : (
              <Alert>
                <AlertTitle>Table assignment disabled</AlertTitle>
                <AlertDescription>Assignments are locked for past bookings.</AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const content = (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header - fixed height */}
      <div className={cn('shrink-0 border-b px-4 py-3', headerTone)}>
        <DialogHeader
          booking={booking}
          status={status}
          formattedDate={formattedDate}
          formattedStartTime={formattedStartTime}
          bookingDate={bookingDate}
          timezone={timezone}
          minutesRemaining={minutesRemaining}
          onClose={() => handleOpenChange(false)}
        />
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySummary}
              disabled={!booking || !summary}
            >
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
            {onCancel && canCancel ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmCancel(true)}
                disabled={isActionPending}
                className="text-destructive hover:text-destructive"
              >
                <Ban className="h-3.5 w-3.5 mr-1" />
                Cancel booking
              </Button>
            ) : null}
            {primaryAction
              ? (() => {
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
                })()
              : null}
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

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the booking as cancelled and notify the guest.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(cancelPending)}>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={Boolean(cancelPending)}
            >
              Confirm cancellation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default BookingDialog;
