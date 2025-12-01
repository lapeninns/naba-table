'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { BookingAssignmentTabContent } from '@/components/features/dashboard/booking-details/BookingAssignmentTabContent';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBookingState } from '@/contexts/booking-state-machine';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { getTodayInTimezone } from '@/lib/utils/datetime';

import {
  BookingHeader,
  BookingHistoryDialog,
  BookingOverviewTab,
  GuestProfilePanel,
  KeyboardShortcutsDialog,
} from './components';
import { useBookingCountdown, useBookingDialogState, useKeyboardShortcuts } from './hooks';

import type { BookingDetailsDialogProps, BookingDetailsTab } from './types';

/**
 * Main BookingDetailsDialog component
 * 
 * SOLID Principles Applied:
 * - SRP: Orchestrates child components, each with single responsibility
 * - OCP: New tabs/dialogs can be added via composition
 * - DIP: Depends on abstractions (props interfaces)
 * - ISP: Props are scoped per child component needs
 */
export function BookingDetailsDialog({
  booking,
  summary,
  allowTableAssignments,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  onUndoNoShow,
  pendingLifecycleAction,
  onUnassignTable,
  open,
  onOpenChange,
}: BookingDetailsDialogProps) {
  const queryClient = useQueryClient();
  const supportsTableAssignment = allowTableAssignments;

  // --- State Management (SRP: Dialog state in dedicated hook) ---
  const dialogState = useBookingDialogState({
    open,
    onOpenChange,
    supportsTableAssignment,
  });

  // --- Time Intelligence (SRP: Countdown logic in dedicated hook) ---
  const countdown = useBookingCountdown({
    startTime: booking.startTime,
    date: summary.date,
    timezone: summary.timezone,
    checkedInAt: booking.checkedInAt,
  });

  // --- Derived State ---
  const bookingState = useBookingState(booking.id);
  const effectiveStatus = bookingState.effectiveStatus ?? booking.status;
  const lifecyclePending = pendingLifecycleAction ?? dialogState.localPendingAction;
  const isCancelled = effectiveStatus === 'cancelled';

  const lifecycleAvailability = useMemo(
    () => ({ isToday: getTodayInTimezone(summary.timezone) === summary.date }),
    [summary.date, summary.timezone]
  );

  // --- Lifecycle Action Handlers (SRP: Action execution) ---
  const handleCheckIn = useCallback(async () => {
    if (!onCheckIn) return;
    // If PRIORITY_WAITLIST, switch to tables tab
    if (effectiveStatus === 'PRIORITY_WAITLIST') {
      dialogState.setActiveTab('tables');
      dialogState.setLocalPendingAction(null);
      return;
    }
    dialogState.setLocalPendingAction('check-in');
    try {
      await onCheckIn();
    } finally {
      dialogState.setLocalPendingAction(null);
    }
  }, [onCheckIn, effectiveStatus, dialogState]);

  const handleCheckOut = useCallback(async () => {
    if (!onCheckOut) return;
    dialogState.setLocalPendingAction('check-out');
    try {
      await onCheckOut();
    } finally {
      dialogState.setLocalPendingAction(null);
    }
  }, [onCheckOut, dialogState]);

  const handleMarkNoShow = useCallback(
    async (options?: { performedAt?: string | null; reason?: string | null }) => {
      if (!onMarkNoShow) return;
      dialogState.setLocalPendingAction('no-show');
      try {
        await onMarkNoShow(options);
      } finally {
        dialogState.setLocalPendingAction(null);
      }
    },
    [onMarkNoShow, dialogState]
  );

  const handleUndoNoShow = useCallback(
    async (reason?: string | null) => {
      if (!onUndoNoShow) return;
      dialogState.setLocalPendingAction('undo-no-show');
      try {
        await onUndoNoShow(reason);
      } finally {
        dialogState.setLocalPendingAction(null);
      }
    },
    [onUndoNoShow, dialogState]
  );

  // --- Keyboard Shortcuts (SRP: Keyboard handling in dedicated hook) ---
  useKeyboardShortcuts({
    isOpen: dialogState.isOpen,
    effectiveStatus,
    isPending: Boolean(lifecyclePending),
    showShortcuts: dialogState.showShortcuts,
    setShowShortcuts: dialogState.setShowShortcuts,
    closeDialog: () => dialogState.setIsOpen(false),
    handlers: {
      handleCheckIn,
      handleCheckOut,
      handleMarkNoShow,
      handleUndoNoShow,
    },
  });

  // --- Event Handlers ---
  const handleOpenHistory = useCallback(() => {
    dialogState.setIsHistoryOpen(true);
  }, [dialogState]);

  const handleOpenShortcuts = useCallback(() => {
    dialogState.setShowShortcuts(true);
  }, [dialogState]);

  const handleAssignmentComplete = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(booking.id) });
  }, [queryClient, booking.id]);

  // Determine if controlled mode
  const isControlled = open !== undefined;

  return (
    <>
      <Dialog open={dialogState.isOpen} onOpenChange={dialogState.setIsOpen}>
        {/* Trigger (only in uncontrolled mode) */}
        {!isControlled && (
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-11 min-w-[100px] touch-manipulation">
              Details
            </Button>
          </DialogTrigger>
        )}

        {/* Dialog Content */}
        <DialogContent className="max-w-[80vw] max-h-[90vh] overflow-hidden p-0 gap-0">
          <div className="grid h-full max-h-[90vh] lg:grid-cols-12">
            {/* LEFT SIDEBAR: Guest Context (SRP: Guest display) */}
            <GuestProfilePanel booking={booking} />

            {/* RIGHT CONTENT: Operations */}
            <div className="flex flex-col lg:col-span-8 h-full overflow-hidden">
              {/* Header (SRP: Status and actions) */}
              <BookingHeader
                booking={booking}
                summary={summary}
                effectiveStatus={effectiveStatus}
                minutesRemaining={countdown.minutesRemaining}
                timeStatus={countdown.timeStatus}
                checkedInRelativeTime={countdown.checkedInRelativeTime}
                supportsTableAssignment={supportsTableAssignment}
                onOpenHistory={handleOpenHistory}
                onOpenShortcuts={handleOpenShortcuts}
              />

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto p-6">
                <Tabs
                  value={dialogState.activeTab}
                  onValueChange={(value) => dialogState.setActiveTab(value as BookingDetailsTab)}
                  className="space-y-5 py-4"
                >
                  <TabsList
                    className={cn('grid w-full gap-2', supportsTableAssignment ? 'grid-cols-2' : 'grid-cols-1')}
                  >
                    <TabsTrigger value="overview" className="text-sm font-medium">
                      Overview
                    </TabsTrigger>
                    {supportsTableAssignment && (
                      <TabsTrigger value="tables" className="text-sm font-medium">
                        Tables
                      </TabsTrigger>
                    )}
                  </TabsList>

                  {/* Overview Tab (SRP: Booking overview) */}
                  <TabsContent value="overview" className="focus-visible:outline-none animate-in fade-in-50 slide-in-from-bottom-2">
                    <BookingOverviewTab
                      booking={booking}
                      summary={summary}
                      effectiveStatus={effectiveStatus}
                      isCancelled={isCancelled}
                      supportsTableAssignment={supportsTableAssignment}
                      lifecycleAvailability={lifecycleAvailability}
                      lifecyclePending={lifecyclePending}
                      relativeStartTime={countdown.relativeStartTime}
                      checkedInRelativeTime={countdown.checkedInRelativeTime}
                      onCheckIn={handleCheckIn}
                      onCheckOut={handleCheckOut}
                      onMarkNoShow={handleMarkNoShow}
                      onUndoNoShow={handleUndoNoShow}
                    />
                  </TabsContent>

                  {/* Tables Tab (SRP: Table assignment) */}
                  {supportsTableAssignment && (
                    <TabsContent value="tables" className="mt-0 h-full flex-col overflow-hidden data-[state=active]:flex">
                      <BookingAssignmentTabContent
                        booking={booking}
                        restaurantId={summary.restaurantId}
                        date={summary.date}
                        onUnassignTable={onUnassignTable}
                        onAssignmentComplete={handleAssignmentComplete}
                      />
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog (SRP: History display) */}
      <BookingHistoryDialog
        open={dialogState.isHistoryOpen}
        onOpenChange={dialogState.setIsHistoryOpen}
        bookingId={booking.id}
        timezone={summary.timezone}
      />

      {/* Keyboard Shortcuts Dialog (SRP: Shortcuts display) */}
      <KeyboardShortcutsDialog
        open={dialogState.showShortcuts}
        onOpenChange={dialogState.setShowShortcuts}
      />
    </>
  );
}
