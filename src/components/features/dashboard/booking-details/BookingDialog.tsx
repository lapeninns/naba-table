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
  Check,
  Copy,
  LayoutGrid,
  LogIn,
  LogOut,
  MoreHorizontal,
  Phone,
  RotateCcw,
  UserX,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { OpsCancelBookingAlertDialog } from '@/components/features/bookings/components/OpsCancelBookingAlertDialog';
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
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';

import { BookingDialogBody, DialogHeader } from './components';
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
  const tableAssignmentPrimaryFocusRef = useRef<HTMLButtonElement | null>(null);
  const tableAssignmentUserToggledRef = useRef(false);
  const shouldFocusTablePanelRef = useRef(false);

  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  const [copySummaryStatus, setCopySummaryStatus] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );
  const [srStatusMessage, setSrStatusMessage] = useState<string>('');

  useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    // Some non-browser runtimes expose a stub matchMedia that returns undefined.
    return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)')?.matches);
  }, []);

  const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

  const isEditableTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    if (target.closest('[contenteditable="true"]')) return true;
    return Boolean(target.closest('input, textarea, select'));
  }, []);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
  }, [isOpen]);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (!isOpen && wasOpen) {
      const previous = previousFocusRef.current;
      if (previous && document.contains(previous)) {
        requestAnimationFrame(() => previous.focus());
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setIsTableAssignmentOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (copySummaryStatus === 'idle') return;
    const t = window.setTimeout(() => setCopySummaryStatus('idle'), 1800);
    return () => window.clearTimeout(t);
  }, [copySummaryStatus]);

  useEffect(() => {
    if (!srStatusMessage) return;
    const t = window.setTimeout(() => setSrStatusMessage(''), 2000);
    return () => window.clearTimeout(t);
  }, [srStatusMessage]);

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

  useEffect(() => {
    if (!isOpen || !isMobile) return;
    if (!needsAssignment) return;
    if (tableAssignmentUserToggledRef.current) return;
    setIsTableAssignmentOpen(true);
  }, [isMobile, isOpen, needsAssignment]);

  useEffect(() => {
    if (!shouldFocusTablePanelRef.current) return;
    if (!isOpen) return;
    if (isMobile && !isTableAssignmentOpen) return;

    shouldFocusTablePanelRef.current = false;

    const panel = tablePanelRef.current;
    if (panel) {
      panel.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
    }

    requestAnimationFrame(() => {
      tableAssignmentPrimaryFocusRef.current?.focus();
    });
  }, [isMobile, isOpen, isTableAssignmentOpen, scrollBehavior]);

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

    const ok = await copyToClipboard(summaryText);
    setCopySummaryStatus(ok ? 'copied' : 'failed');
    setSrStatusMessage(ok ? 'Summary copied to clipboard.' : 'Unable to copy summary.');
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
          shouldFocusTablePanelRef.current = true;
          if (isMobile) {
            setIsTableAssignmentOpen(true);
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
      metaOrCtrl: true,
      enabled: Boolean(isOpen && primaryAction),
      when: () => {
        if (confirmNoShow || confirmCancel) return false;
        if (isEditableTarget(document.activeElement)) return false;
        return true;
      },
      handler: () => {
        if (isOpen && primaryAction) primaryAction.onClick();
      },
    },
  ]);

  const handleTableAssignmentOpenChange = useCallback(
    (nextOpen: boolean) => {
      tableAssignmentUserToggledRef.current = true;
      setIsTableAssignmentOpen(nextOpen);
    },
    [setIsTableAssignmentOpen],
  );

  const handleAssignmentComplete = useCallback(() => {
    if (!booking?.id) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(booking.id) });
  }, [booking?.id, queryClient]);

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
      <div className="flex-1 min-h-0 overflow-hidden">
        <BookingDialogBody
          isLoading={isLoading}
          errorMessage={errorMessage}
          onRetry={onRetry}
          booking={booking}
          summary={summary}
          isMobile={isMobile}
          allowTableAssignments={allowTableAssignments}
          needsAssignment={needsAssignment}
          bookingDate={bookingDate}
          timezone={timezone}
          status={status}
          minutesRemaining={minutesRemaining}
          assignedTableRows={assignedTableRows}
          totalCapacity={totalCapacity}
          capacityPercent={capacityPercent}
          isTableAssignmentOpen={isTableAssignmentOpen}
          onTableAssignmentOpenChange={handleTableAssignmentOpenChange}
          tablePanelRef={tablePanelRef}
          tableAssignmentPrimaryFocusRef={tableAssignmentPrimaryFocusRef}
          onAssignmentComplete={handleAssignmentComplete}
          bookingStartTime={booking?.startTime ?? null}
          bookingEndTime={booking?.endTime ?? null}
        />
      </div>
      {/* Footer - fixed height */}
      <div className="shrink-0 border-t bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex items-center justify-between gap-3">
          <div className="hidden sm:block text-xs text-muted-foreground">
            {booking ? `${formattedDate} · ${formattedStartTime}` : 'Booking details'}
          </div>

          <div className="flex items-center gap-2">
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

            {!isMobile && booking?.customerPhone ? (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${formatPhoneForTel(booking.customerPhone)}`}>
                  <Phone className="mr-1 h-3.5 w-3.5" />
                  Call guest
                </a>
              </Button>
            ) : null}

            {booking ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    aria-label="More actions"
                    disabled={isActionPending}
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                    <span className="hidden sm:inline">More</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      void handleCopySummary();
                    }}
                    disabled={!summary}
                    className="gap-2"
                  >
                    {copySummaryStatus === 'copied' ? (
                      <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden />
                    )}
                    {copySummaryStatus === 'copied' ? 'Copied summary' : 'Copy summary'}
                  </DropdownMenuItem>

                  {booking.reference ?? booking.id ? (
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        const text = booking.reference ?? booking.id;
                        void (async () => {
                          const ok = await copyToClipboard(text);
                          setSrStatusMessage(
                            ok ? 'Reference copied to clipboard.' : 'Unable to copy reference.',
                          );
                        })();
                      }}
                      className="gap-2"
                    >
                      <Copy className="h-4 w-4" aria-hidden />
                      Copy reference
                    </DropdownMenuItem>
                  ) : null}

                  {(shouldShowNoShow || (onCancel && canCancel)) ? <DropdownMenuSeparator /> : null}

                  {shouldShowNoShow ? (
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        setConfirmNoShow(true);
                      }}
                      className="gap-2 text-rose-700 focus:text-rose-700"
                    >
                      <UserX className="h-4 w-4" aria-hidden />
                      Mark no-show
                    </DropdownMenuItem>
                  ) : null}

                  {onCancel && canCancel ? (
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        setConfirmCancel(true);
                      }}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <Ban className="h-4 w-4" aria-hidden />
                      Cancel booking
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>

        <div className="sr-only" role="status" aria-live="polite">
          {srStatusMessage}
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
            className={cn(
              'h-[92dvh] max-h-[calc(100dvh-var(--safe-area-inset-top))] p-0 gap-0 overflow-hidden [&>button]:hidden',
              'rounded-t-2xl',
            )}
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

      {onCancel ? (
        <OpsCancelBookingAlertDialog
          open={confirmCancel}
          onOpenChange={setConfirmCancel}
          customerName={booking?.customerName ?? null}
          partySize={booking?.partySize ?? null}
          whenLabel={booking ? `${formattedDate} · ${formattedStartTime}` : null}
          onConfirm={handleCancel}
          isPending={Boolean(cancelPending)}
        />
      ) : null}
    </>
  );
}

export default BookingDialog;
