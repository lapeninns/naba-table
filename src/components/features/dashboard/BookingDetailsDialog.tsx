'use client';

import { Mail, Phone, Clock, Users, Calendar as CalendarIcon, AlertTriangle, Award, CheckCircle2, XCircle, Loader2, LogIn, LogOut, History, ArrowRight, Keyboard } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { BookingActionButton, BookingStatusBadge, StatusTransitionAnimator } from '@/components/features/booking-state-machine';
import type { BookingAction } from '@/components/features/booking-state-machine';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatDateReadable, formatTimeRange, getTodayInTimezone } from '@/lib/utils/datetime';
import { queryKeys } from '@/lib/query/keys';
import { useBookingState } from '@/contexts/booking-state-machine';
import { useBookingService, useTableInventoryService } from '@/contexts/ops-services';
import type { TableInventory } from '@/services/ops/tables';

import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

const TIER_COLORS: Record<string, string> = {
  platinum: 'bg-purple-500 text-white border-purple-500',
  gold: 'bg-yellow-500 text-black border-yellow-500',
  silver: 'bg-gray-400 text-white border-gray-400',
  bronze: 'bg-amber-700 text-white border-amber-700',
};

function expandAssignmentGroups(groups: OpsTodayBooking['tableAssignments']) {
  const expanded: Array<{
    tableId: string;
    tableNumber: string;
    capacity: number | null;
    section: string | null;
  }> = [];

  for (const group of groups ?? []) {
    const members = group?.members ?? [];
    if (members.length === 0) {
      continue;
    }

    for (const member of members) {
      expanded.push({
        tableId: member.tableId,
        tableNumber: member.tableNumber ?? '—',
        capacity: member.capacity ?? null,
        section: member.section ?? null,
      });
    }
  }

  return expanded;
}

type BookingDetailsDialogProps = {
  booking: OpsTodayBooking;
  summary: OpsTodayBookingsSummary;
  onCheckIn?: () => Promise<void>;
  onCheckOut?: () => Promise<void>;
  onMarkNoShow?: (options?: { performedAt?: string | null; reason?: string | null }) => Promise<void>;
  onUndoNoShow?: (reason?: string | null) => Promise<void>;
  pendingLifecycleAction?: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show' | null;
  onAssignTable?: (tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  onUnassignTable?: (tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  tableActionState?: {
    type: 'assign' | 'unassign';
    tableId?: string | null;
  } | null;
};

const DEFAULT_DURATION_MINUTES = 90;

export function BookingDetailsDialog({
  booking,
  summary,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  onUndoNoShow,
  pendingLifecycleAction,
  onAssignTable,
  onUnassignTable,
  tableActionState,
}: BookingDetailsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<OpsTodayBooking['tableAssignments']>(booking.tableAssignments);
  const [localPendingAction, setLocalPendingAction] = useState<BookingAction | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const lifecycleAvailability = useMemo(
    () => ({ isToday: getTodayInTimezone(summary.timezone) === summary.date }),
    [summary.date, summary.timezone],
  );

  const mailHref = booking.customerEmail ? `mailto:${booking.customerEmail}` : null;
  const phoneHref = booking.customerPhone ? `tel:${booking.customerPhone.replace(/[^+\d]/g, '')}` : null;

  const serviceDateReadable = formatDateReadable(summary.date, summary.timezone);
  const serviceTime = formatTimeRange(booking.startTime, booking.endTime, summary.timezone);
  const bookingState = useBookingState(booking.id);
  const effectiveStatus = bookingState.effectiveStatus ?? booking.status;
  const lifecyclePending = pendingLifecycleAction ?? localPendingAction;
  const hasCheckedIn = effectiveStatus === 'checked_in' || effectiveStatus === 'completed';
  const hasCheckedOut = effectiveStatus === 'completed' || Boolean(booking.checkedOutAt);
  const isCancelled = effectiveStatus === 'cancelled';
  const showLifecycleBadges = effectiveStatus !== 'checked_in' && effectiveStatus !== 'completed';
  const tableService = useTableInventoryService();
  const bookingService = useBookingService();
  const supportsTableAssignment = Boolean(onAssignTable && onUnassignTable);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const {
    data: historyData,
    isLoading: historyLoading,
    isError: historyError,
    error: historyErrorObject,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: queryKeys.bookings.history(booking.id),
    queryFn: async () => bookingService.getBookingHistory(booking.id),
    enabled: false,
    staleTime: 60_000,
  });

  const historyEntries = historyData?.entries ?? [];
  const historyErrorMessage = historyErrorObject instanceof Error ? historyErrorObject.message : 'Unable to load history';

  const handleOpenHistory = () => {
    setIsHistoryOpen(true);
    void refetchHistory();
  };

  const formatLifecycleTimestamp = (iso: string | null) => {
    if (!iso) return 'Not yet';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Not yet';
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: summary.timezone,
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    return formatter.format(date);
  };

  const formatHistoryDate = (iso: string | null | undefined) => {
    if (!iso) return null;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return null;
    return format(parsed, 'dd MMM yyyy, HH:mm');
  };

  const getMetadataString = (metadata: Record<string, unknown>, key: string): string | null => {
    const value = metadata?.[key as keyof typeof metadata];
    return typeof value === 'string' && value.length > 0 ? value : null;
  };

  useEffect(() => {
    setAssignments(booking.tableAssignments);
  }, [booking.tableAssignments]);

  const {
    data: tablesResult,
    isLoading: tablesLoading,
    isError: tablesError,
    error: tablesQueryError,
    refetch: refetchTables,
  } = useQuery({
    queryKey: queryKeys.opsTables.list(summary.restaurantId, { scope: 'assignment' }),
    queryFn: async () => tableService.list(summary.restaurantId),
    enabled: supportsTableAssignment && isOpen,
    staleTime: 60_000,
  });

  const bookingWindow = useMemo(() => computeDialogBookingWindow(booking.startTime, booking.endTime), [booking.startTime, booking.endTime]);

  const conflictingTableIds = useMemo(
    () => computeConflictingTableIds(summary.bookings, booking, bookingWindow),
    [summary.bookings, booking, bookingWindow],
  );

  const normalizedAssignments = useMemo(() => expandAssignmentGroups(assignments), [assignments]);

  const assignedTableIds = useMemo(
    () => new Set(normalizedAssignments.map((assignment) => assignment.tableId)),
    [normalizedAssignments],
  );

  const tableOptions = useMemo(() => {
    const data = tablesResult?.tables ?? [];
    return data
      .filter((table) => !assignedTableIds.has(table.id))
      .map((table) => {
        const conflict = bookingWindow ? conflictingTableIds.has(table.id) : false;
        const isOutOfService = table.status === 'out_of_service';
        const disabled = isOutOfService;
        const labelParts = [`Table ${table.tableNumber}`];
        if (table.capacity) {
          labelParts.push(`${table.capacity} seat${table.capacity === 1 ? '' : 's'}`);
        }
        if (table.section) {
          labelParts.push(table.section);
        }
        const reason = isOutOfService
          ? 'Out of service'
          : conflict
            ? 'Potential conflict (local cache)'
            : null;
        return {
          table,
          label: labelParts.join(' · '),
          disabled,
          reason,
          conflict,
        };
      });
  }, [tablesResult?.tables, assignedTableIds, conflictingTableIds, bookingWindow]);

  const hasAssignableTables = tableOptions.some((option) => !option.disabled);
  const selectedOption = selectedTableId
    ? tableOptions.find((option) => option.table.id === selectedTableId) ?? null
    : null;

  useEffect(() => {
    if (!isOpen) {
      setSelectedTableId(null);
      setLocalPendingAction(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (supportsTableAssignment && isOpen) {
      void refetchTables();
    }
  }, [supportsTableAssignment, isOpen, refetchTables]);

  const handleAssignTable = async () => {
    if (!selectedTableId || !onAssignTable) {
      return;
    }
    try {
      const updated = await onAssignTable(selectedTableId);
      setAssignments(updated);
      setSelectedTableId(null);
      void refetchTables();
    } catch (error) {
      // Toast handled by mutation hook
    }
  };

  const handleUnassignTable = async (tableId: string) => {
    if (!onUnassignTable) {
      return;
    }
    try {
      const updated = await onUnassignTable(tableId);
      setAssignments(updated);
      void refetchTables();
    } catch (error) {
      // Toast handled by mutation hook
    }
  };

  const handleCheckInAction = async () => {
    if (!onCheckIn) return;
    setLocalPendingAction('check-in');
    try {
      await onCheckIn();
    } finally {
      setLocalPendingAction(null);
    }
  };

  const handleCheckOutAction = async () => {
    if (!onCheckOut) return;
    setLocalPendingAction('check-out');
    try {
      await onCheckOut();
    } finally {
      setLocalPendingAction(null);
    }
  };

  const handleMarkNoShowAction = async (options?: { performedAt?: string | null; reason?: string | null }) => {
    if (!onMarkNoShow) return;
    setLocalPendingAction('no-show');
    try {
      await onMarkNoShow(options);
    } finally {
      setLocalPendingAction(null);
    }
  };

  const handleUndoNoShowAction = async (reason?: string | null) => {
    if (!onUndoNoShow) return;
    setLocalPendingAction('undo-no-show');
    try {
      await onUndoNoShow(reason);
    } finally {
      setLocalPendingAction(null);
    }
  };

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable) {
          return;
        }
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        if (showShortcuts) {
          setShowShortcuts(false);
        } else {
          setIsOpen(false);
        }
        return;
      }

      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault();
        setShowShortcuts(true);
        return;
      }

      if (lifecyclePending) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'i' && effectiveStatus === 'confirmed') {
        event.preventDefault();
        void handleCheckInAction();
        return;
      }
      if (key === 'o' && effectiveStatus === 'checked_in') {
        event.preventDefault();
        void handleCheckOutAction();
        return;
      }
      if (key === 'n' && effectiveStatus === 'confirmed') {
        event.preventDefault();
        void handleMarkNoShowAction();
        return;
      }
      if (key === 'u' && effectiveStatus === 'no_show') {
        event.preventDefault();
        void handleUndoNoShowAction();
      }
    },
    [effectiveStatus, handleCheckInAction, handleCheckOutAction, handleMarkNoShowAction, handleUndoNoShowAction, isOpen, lifecyclePending, showShortcuts],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, isOpen]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-11 min-w-[100px] touch-manipulation">
            Details
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 text-xl font-semibold text-foreground">
            <span>{booking.customerName}</span>
            <div className="flex flex-wrap items-center gap-2">
              <StatusTransitionAnimator
                status={bookingState.status}
                effectiveStatus={bookingState.effectiveStatus}
                isTransitioning={bookingState.isTransitioning}
                className="inline-flex rounded-full"
                overlayClassName="inline-flex"
              >
                <BookingStatusBadge status={effectiveStatus} />
              </StatusTransitionAnimator>
              {showLifecycleBadges && booking.checkedInAt ? (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                  Checked in
                </Badge>
              ) : null}
              {showLifecycleBadges && booking.checkedOutAt ? (
                <Badge variant="outline" className="bg-slate-100 text-slate-700">
                  Checked out
                </Badge>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-3 text-xs font-semibold"
                onClick={() => setShowShortcuts(true)}
              >
                <Keyboard className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Shortcuts
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-xs font-semibold"
                onClick={handleOpenHistory}
              >
                <History className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                View history
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {serviceDateReadable} · {serviceTime}
          </DialogDescription>
          <div className="mt-4 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Status actions</h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <BookingActionButton
                booking={booking}
                pendingAction={lifecyclePending}
                onCheckIn={handleCheckInAction}
                onCheckOut={handleCheckOutAction}
                onMarkNoShow={handleMarkNoShowAction}
                onUndoNoShow={handleUndoNoShowAction}
                showConfirmation
                lifecycleAvailability={lifecycleAvailability}
              />
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <section className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={Clock} label="Time" value={serviceTime} />
            <InfoRow icon={Users} label="Guests" value={`${booking.partySize}`} />
            <InfoRow icon={CalendarIcon} label="Service date" value={serviceDateReadable} />
            <InfoRow icon={Mail} label="Email" value={booking.customerEmail ?? 'Not provided'} href={mailHref ?? undefined} />
            <InfoRow icon={Phone} label="Phone" value={booking.customerPhone ?? 'Not provided'} href={phoneHref ?? undefined} />
            <InfoRow icon={LogIn} label="Checked in" value={formatLifecycleTimestamp(booking.checkedInAt)} />
            <InfoRow icon={LogOut} label="Checked out" value={formatLifecycleTimestamp(booking.checkedOutAt)} />
          </section>

          {booking.notes ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Booking Notes</h3>
              <p className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-sm text-foreground">
                {booking.notes}
              </p>
            </section>
          ) : null}

          {(booking.loyaltyTier || booking.allergies || booking.dietaryRestrictions || booking.seatingPreference || booking.profileNotes || booking.marketingOptIn !== null) ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Guest Profile</h3>
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 px-4 py-4">
                {booking.loyaltyTier ? (
                  <div className="flex items-center gap-3">
                    <Award className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Loyalty:</span>
                      <Badge variant="outline" className={cn('text-xs font-semibold', TIER_COLORS[booking.loyaltyTier])}>
                        {booking.loyaltyTier}
                      </Badge>
                      {booking.loyaltyPoints !== null && booking.loyaltyPoints !== undefined ? (
                        <span className="text-xs text-muted-foreground">({booking.loyaltyPoints} points)</span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {booking.allergies && booking.allergies.length > 0 ? (
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" aria-hidden />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-orange-600">Allergies:</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {booking.allergies.map((allergy, idx) => (
                          <Badge key={idx} variant="outline" className="border-orange-600 text-orange-600">
                            {allergy}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {booking.dietaryRestrictions && booking.dietaryRestrictions.length > 0 ? (
                  <div className="flex items-start gap-3">
                    <Users className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden />
                    <div className="flex-1">
                      <span className="text-sm text-muted-foreground">Dietary Restrictions:</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {booking.dietaryRestrictions.map((restriction, idx) => (
                          <Badge key={idx} variant="secondary">
                            {restriction}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {booking.seatingPreference ? (
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <div>
                      <span className="text-sm text-muted-foreground">Seating Preference:</span>
                      <span className="ml-2 text-sm text-foreground">{booking.seatingPreference}</span>
                    </div>
                  </div>
                ) : null}

                {booking.marketingOptIn !== null && booking.marketingOptIn !== undefined ? (
                  <div className="flex items-center gap-3">
                    {booking.marketingOptIn ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
                    )}
                    <span className="text-sm text-muted-foreground">
                      Marketing: {booking.marketingOptIn ? 'Opted in' : 'Opted out'}
                    </span>
                  </div>
                ) : null}

                {booking.profileNotes ? (
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-foreground">Profile Notes:</span>
                    <p className="text-sm text-muted-foreground">{booking.profileNotes}</p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {supportsTableAssignment ? (
            <section className="space-y-4 rounded-2xl border border-border/60 bg-muted/10 px-4 py-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Table assignment</h3>
                <p className="text-xs text-muted-foreground">Assign or adjust tables for this reservation.</p>
              </div>

            <div className="space-y-2">
              {normalizedAssignments.length > 0 ? (
                <>
                  {normalizedAssignments.map((assignment) => {
                  const isUnassigning =
                    tableActionState?.type === 'unassign' && tableActionState?.tableId === assignment.tableId;
                  const capacityLabel =
                    assignment.capacity && assignment.capacity > 0
                      ? `${assignment.capacity} seat${assignment.capacity === 1 ? '' : 's'}`
                      : null;
                  const meta = [capacityLabel, assignment.section ? `Section ${assignment.section}` : null]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <div
                      key={assignment.tableId}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-white px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">Table {assignment.tableNumber}</span>
                        {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => handleUnassignTable(assignment.tableId)}
                        disabled={isUnassigning || tableActionState?.type === 'assign'}
                      >
                        {isUnassigning ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                            Removing…
                          </>
                        ) : (
                          'Remove'
                        )}
                      </Button>
                    </div>
                  );
                })}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No tables assigned yet.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`table-select-${booking.id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Assign new table
              </Label>
              {tablesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading tables…
                </div>
              ) : tablesError ? (
                <p className="text-sm text-destructive">
                  {tablesQueryError instanceof Error ? tablesQueryError.message : 'Unable to load tables'}
                </p>
              ) : (
                <Select
                  value={selectedTableId ?? ''}
                  onValueChange={(value) => setSelectedTableId(value)}
                  disabled={!hasAssignableTables || tableActionState?.type === 'assign'}
                >
                  <SelectTrigger id={`table-select-${booking.id}`} className="w-full">
                    <SelectValue placeholder={hasAssignableTables ? 'Choose a table' : 'No tables available'} />
                  </SelectTrigger>
                  <SelectContent>
                    {tableOptions.map((option) => (
                      <SelectItem key={option.table.id} value={option.table.id} disabled={option.disabled}>
                        {option.label}
                        {option.reason ? ` — ${option.reason}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!hasAssignableTables && !tablesLoading && !tablesError ? (
                <p className="text-xs text-muted-foreground">No available tables match this booking window.</p>
              ) : null}
              {bookingWindow === null ? (
                <p className="text-xs text-muted-foreground">Booking time is incomplete, so availability checks may be inaccurate.</p>
              ) : null}
              {selectedOption?.conflict ? (
                <p className="flex items-center gap-2 text-xs text-amber-600" role="status" aria-live="polite">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  Local data suggests a potential overlap—you can still submit and the system will confirm availability.
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleAssignTable}
                disabled={!selectedTableId || tableActionState?.type === 'assign'}
                className="h-9"
              >
                {tableActionState?.type === 'assign' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Assigning…
                  </>
                ) : (
                  'Assign table'
                )}
              </Button>
            </div>
            </section>
          ) : null}

          <aside className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 px-4 py-4">
            <h3 className="text-sm font-semibold text-foreground">Status actions</h3>
            <p className="text-xs text-muted-foreground">
              Keep the team in sync by recording shows and no-shows as service progresses.
            </p>
            <BookingActionButton
              booking={booking}
              pendingAction={lifecyclePending}
              onCheckIn={handleCheckInAction}
              onCheckOut={handleCheckOutAction}
              onMarkNoShow={handleMarkNoShowAction}
              onUndoNoShow={handleUndoNoShowAction}
              showConfirmation
              lifecycleAvailability={lifecycleAvailability}
            />

            {isCancelled ? (
              <p className="flex items-center gap-2 rounded-md border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                This booking has been cancelled. Status changes are disabled.
              </p>
            ) : null}
          </aside>
        </div>
      </DialogContent>
      </Dialog>
      <Dialog
        open={isHistoryOpen}
        onOpenChange={(open) => {
          setIsHistoryOpen(open);
          if (open) {
            void refetchHistory();
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking history</DialogTitle>
            <DialogDescription>Lifecycle changes recorded for this reservation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {historyLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading history…
              </div>
            ) : historyError ? (
              <p className="text-sm text-destructive">{historyErrorMessage}</p>
            ) : historyEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lifecycle changes have been recorded yet.</p>
            ) : (
              historyEntries.map((entry) => {
                const actorLabel = entry.actor?.name ?? entry.actor?.email ?? 'System';
                const actionValue = getMetadataString(entry.metadata, 'action');
                const actionLabel = actionValue ? actionValue.replace(/[-_]/g, ' ') : null;
                const performedAtLabel = formatHistoryDate(getMetadataString(entry.metadata, 'performedAt'));
                const changedAtLabel = formatHistoryDate(entry.changedAt) ?? entry.changedAt;

                return (
                  <div key={entry.id} className="rounded-xl border border-border/60 bg-muted/10 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {entry.fromStatus ? (
                          <BookingStatusBadge status={entry.fromStatus} size="sm" showTooltip />
                        ) : (
                          <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wide">
                            New
                          </Badge>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        <BookingStatusBadge status={entry.toStatus} size="sm" showTooltip />
                      </div>
                      <span className="text-xs text-muted-foreground">{changedAtLabel}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">{actorLabel}</p>
                    {actionLabel ? (
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Action: {actionLabel}</p>
                    ) : null}
                    {entry.reason ? (
                      <p className="mt-1 text-sm text-muted-foreground">Reason: {entry.reason}</p>
                    ) : null}
                    {performedAtLabel ? (
                      <p className="mt-1 text-xs text-muted-foreground">Performed at: {performedAtLabel}</p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Use these keys to manage the booking without leaving the keyboard.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <ShortcutHint keys={['I']} description="Check in booking" />
            <ShortcutHint keys={['O']} description="Check out booking" />
            <ShortcutHint keys={['N']} description="Mark no-show" />
            <ShortcutHint keys={['U']} description="Undo no-show" />
            <ShortcutHint keys={['Esc']} description="Close this dialog" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

type InfoRowProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
};

function InfoRow({ icon: Icon, label, value, href }: InfoRowProps) {
  const content = (
    <div className="flex flex-col">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      {href ? (
        <a href={href} className="text-sm text-primary underline-offset-4 hover:underline">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}

type ShortcutHintProps = {
  keys: string[];
  description: string;
};

function ShortcutHint({ keys, description }: ShortcutHintProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
      <div className="flex items-center gap-1">
        {keys.map((keyValue, index) => (
          <span key={keyValue} className="flex items-center gap-1">
            <kbd className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold uppercase text-foreground">
              {keyValue}
            </kbd>
            {index < keys.length - 1 ? <span className="text-xs text-muted-foreground">+</span> : null}
          </span>
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{description}</span>
    </div>
  );
}

type DialogBookingWindow = {
  start: number;
  end: number;
};

function parseMinutes(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function computeDialogBookingWindow(startTime: string | null, endTime: string | null): DialogBookingWindow | null {
  const start = parseMinutes(startTime);
  if (start === null) {
    return null;
  }
  const endCandidate = parseMinutes(endTime);
  const end = endCandidate !== null && endCandidate > start ? endCandidate : start + DEFAULT_DURATION_MINUTES;
  return { start, end };
}

function windowsOverlap(a: DialogBookingWindow, b: DialogBookingWindow): boolean {
  return a.start < b.end && b.start < a.end;
}

function computeConflictingTableIds(
  bookings: OpsTodayBooking[],
  current: OpsTodayBooking,
  window: DialogBookingWindow | null,
): Set<string> {
  const conflicts = new Set<string>();
  if (!window) {
    return conflicts;
  }

  for (const booking of bookings) {
    if (booking.id === current.id) {
      continue;
    }

    if (!booking.tableAssignments || booking.tableAssignments.length === 0) {
      continue;
    }

    if (booking.status === 'cancelled' || booking.status === 'no_show') {
      continue;
    }

    const otherWindow = computeDialogBookingWindow(booking.startTime, booking.endTime);
    if (!otherWindow) {
      continue;
    }

    if (!windowsOverlap(window, otherWindow)) {
      continue;
    }

    const expandedAssignments = expandAssignmentGroups(booking.tableAssignments);
    for (const assignment of expandedAssignments) {
      conflicts.add(assignment.tableId);
    }
  }

  return conflicts;
}
