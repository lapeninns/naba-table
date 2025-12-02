'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Calendar as CalendarIcon, Clock, LayoutGrid, Users, Mail, Phone, Hash, Info } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { BookingAssignmentTabContent } from '@/components/features/dashboard/booking-details/BookingAssignmentTabContent';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBookingState } from '@/contexts/booking-state-machine';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { getTodayInTimezone } from '@/lib/utils/datetime';

import {
  BookingHistoryDialog,
  BookingOverviewTab,
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

  const assignedCapacity = useMemo(() => {
    return (booking.tableAssignments ?? []).reduce((sum, group) => {
      if (typeof group.capacitySum === 'number') return sum + group.capacitySum;
      const membersCapacity = group.members.reduce((s, m) => s + (m.capacity ?? 0), 0);
      return sum + membersCapacity;
    }, 0);
  }, [booking.tableAssignments]);

  const assignedTablesCount = useMemo(() => {
    return (booking.tableAssignments ?? []).reduce((sum, group) => sum + group.members.length, 0);
  }, [booking.tableAssignments]);

  const capacityDelta = assignedCapacity - booking.partySize;

  const refLabel = booking.reference ?? booking.id;
  const refShort = refLabel.length > 10 ? `${refLabel.slice(0, 6)}…${refLabel.slice(-4)}` : refLabel;

  const SummaryStat = ({
    icon: Icon,
    label,
    value,
    helper,
    tone,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    helper?: string;
    tone?: 'positive' | 'negative';
  }) => (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-xl border px-3 py-2 shadow-sm bg-background/80',
        tone === 'positive' && 'border-emerald-200 bg-emerald-50/60 text-emerald-700',
        tone === 'negative' && 'border-red-200 bg-red-50/60 text-red-700'
      )}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-2xl font-bold leading-tight text-foreground">{value}</div>
      {helper ? <div className="text-xs text-muted-foreground">{helper}</div> : null}
    </div>
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
  const handleAssignmentComplete = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(booking.id) });
  }, [queryClient, booking.id]);

  // Determine if controlled mode
  const isControlled = open !== undefined;

  return (
    <>
      <Dialog open={dialogState.isOpen} onOpenChange={dialogState.setIsOpen}>
        {!isControlled && (
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-11 min-w-[100px] touch-manipulation">
              Details
            </Button>
          </DialogTrigger>
        )}

        <DialogContent className="max-w-[1200px] max-h-[90vh] overflow-hidden p-0 gap-0">
          <div className="flex h-full flex-col overflow-hidden">
            {/* Hero / Summary */}
            <div className="border-b bg-muted/40 px-6 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border-2 border-primary/30 text-lg font-bold text-primary shadow-sm">
                    {booking.customerName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-foreground">{booking.customerName}</h2>
                      <Badge variant="outline" className="px-3 py-1 text-xs font-semibold">
                        {booking.loyaltyTier ?? 'Guest'}
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <Hash className="h-3.5 w-3.5" /> {refShort}
                      </Badge>
                      {booking.source && (
                        <Badge variant="outline" className="gap-1">
                          <Info className="h-3.5 w-3.5" /> {booking.source}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4" /> {summary.date}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-4 w-4" /> {booking.startTime} – {booking.endTime}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <Badge variant="secondary" className="capitalize">
                        {effectiveStatus.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-foreground/80">
                      {booking.customerEmail && (
                        <a
                          href={`mailto:${booking.customerEmail}`}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 hover:bg-secondary/80 transition"
                        >
                          <Mail className="h-3.5 w-3.5" /> {booking.customerEmail}
                        </a>
                      )}
                      {booking.customerPhone && (
                        <a
                          href={`tel:${booking.customerPhone.replace(/[^+\d]/g, '')}`}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 hover:bg-secondary/80 transition"
                        >
                          <Phone className="h-3.5 w-3.5" /> {booking.customerPhone}
                        </a>
                      )}
                      {booking.seatingPreference && (
                        <Badge variant="outline" className="gap-1">
                          Preference: {booking.seatingPreference}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryStat icon={Users} label="Party" value={`${booking.partySize}`} />
                  <SummaryStat icon={LayoutGrid} label="Tables" value={`${assignedTablesCount}`} helper="assigned" />
                  <SummaryStat icon={LayoutGrid} label="Capacity" value={`${assignedCapacity}`} helper="seats" />
                  <SummaryStat
                    icon={AlertCircle}
                    label="Delta"
                    value={`${capacityDelta >= 0 ? '+' : ''}${capacityDelta}`}
                    helper="vs party"
                    tone={capacityDelta >= 0 ? 'positive' : 'negative'}
                  />
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <Tabs
                value={dialogState.activeTab}
                onValueChange={(value) => dialogState.setActiveTab(value as BookingDetailsTab)}
                className="space-y-4"
              >
                <TabsList className={cn('grid w-full gap-2', supportsTableAssignment ? 'grid-cols-2' : 'grid-cols-1')}>
                  <TabsTrigger value="overview" className="text-sm font-medium">
                    Overview
                  </TabsTrigger>
                  {supportsTableAssignment && (
                    <TabsTrigger value="tables" className="text-sm font-medium">
                      Tables
                    </TabsTrigger>
                  )}
                </TabsList>

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

                {supportsTableAssignment && (
                  <TabsContent value="tables" className="mt-0 h-full data-[state=active]:block">
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
