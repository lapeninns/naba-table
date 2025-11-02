'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Mail, Phone, Clock, Users, Calendar as CalendarIcon, AlertTriangle, Award, CheckCircle2, XCircle, Loader2, LogIn, LogOut, History, ArrowRight, Keyboard } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';

import { BookingActionButton, BookingStatusBadge, StatusTransitionAnimator } from '@/components/features/booking-state-machine';
import {
  ManualAssignmentActions,
  ManualAssignmentSummaryCard,
  ManualAssignmentValidationPanel,
} from '@/components/features/dashboard/manual-assignment';
import { TableFloorPlan } from '@/components/features/dashboard/TableFloorPlan';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useBookingState } from '@/contexts/booking-state-machine';
import { useBookingService } from '@/contexts/ops-services';
import { useManualAssignmentContext } from '@/hooks/ops/useManualAssignmentContext';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { formatDateReadable, formatTimeRange, getTodayInTimezone } from '@/lib/utils/datetime';

import { extractManualHoldValidation, isManualHoldValidationError } from './manualHoldHelpers';

import type { BookingAction } from '@/components/features/booking-state-machine';
import type {
  ManualSelectionPayload,
  ManualHoldPayload,
  ManualValidationResult,
} from '@/services/ops/bookings';
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

function formatSlack(slack: number): string {
  if (slack === 0) {
    return 'exact fit';
  }
  if (slack > 0) {
    return `+${slack} over`;
  }
  return `${slack} short`;
}

function formatCountdownFromIso(expiresAt: string | null, nowTs: number): string | null {
  if (!expiresAt) {
    return null;
  }
  const target = Date.parse(expiresAt);
  if (Number.isNaN(target)) {
    return null;
  }
  const diffSeconds = Math.max(0, Math.floor((target - nowTs) / 1000));
  const minutes = Math.floor(diffSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(diffSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

type BookingDetailsDialogProps = {
  booking: OpsTodayBooking;
  summary: OpsTodayBookingsSummary;
  allowTableAssignments: boolean;
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

type BookingDetailsTab = 'overview' | 'tables';

const MANUAL_HOLD_TTL_SECONDS = 180;

export function BookingDetailsDialog({
  booking,
  summary,
  allowTableAssignments,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  onUndoNoShow,
  pendingLifecycleAction,
  onAssignTable: _onAssignTable,
  onUnassignTable,
  tableActionState,
}: BookingDetailsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [userModifiedSelection, setUserModifiedSelection] = useState(false);
  const [validationResult, setValidationResult] = useState<ManualValidationResult | null>(null);
  const [lastValidatedAt, setLastValidatedAt] = useState<number | null>(null);
  const [requireAdjacency, setRequireAdjacency] = useState(true);
  const [lastHoldKey, setLastHoldKey] = useState<string | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const [assignments, setAssignments] = useState<OpsTodayBooking['tableAssignments']>(booking.tableAssignments);
  const [localPendingAction, setLocalPendingAction] = useState<BookingAction | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [activeTab, setActiveTab] = useState<BookingDetailsTab>('overview');
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [staleContext, setStaleContext] = useState(false);
  const [lastApiError, setLastApiError] = useState<null | { scope: 'validate'|'hold'|'confirm', code: string | null, message: string, details?: any }>(null);
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
  const isCancelled = effectiveStatus === 'cancelled';
  const showLifecycleBadges = effectiveStatus !== 'checked_in' && effectiveStatus !== 'completed';
  const bookingService = useBookingService();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const supportsTableAssignment = allowTableAssignments;
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const manualContextQuery = useManualAssignmentContext({
    bookingId: isOpen ? booking.id : null,
    restaurantId: summary.restaurantId,
    targetDate: summary.date,
    enabled: supportsTableAssignment && isOpen,
  });

  const {
    data: manualContextData,
    isLoading: manualContextLoading,
    isFetching: manualContextFetching,
    isError: manualContextIsError,
    error: manualContextError,
    refetch: refetchManualContext,
  } = manualContextQuery;
  const manualContext = manualContextData ?? null;

  const holdMutation = useMutation({
    mutationFn: (payload: ManualHoldPayload) => bookingService.manualHoldSelection(payload),
    onSuccess: (result) => {
      setStaleContext(false);
      setValidationResult(result.validation);
      setLastValidatedAt(Date.now());
      const holdKey = result.hold ? result.hold.tableIds.slice().sort().join(',') : null;
      setLastHoldKey(holdKey);
      if (result.hold) {
        setUserModifiedSelection(false);
        void queryClient.invalidateQueries({ queryKey: queryKeys.manualAssign.context(booking.id) });
      } else {
        setUserModifiedSelection(true);
      }
    },
    onError: async (error, variables) => {
      if ((error as any)?.code === 'STALE_CONTEXT') {
        setStaleContext(true);
        return;
      }
      if (isManualHoldValidationError(error)) {
        const validation = extractManualHoldValidation(error);
        if (validation) {
          setValidationResult(validation);
        } else if (variables) {
          try {
            const result = await bookingService.manualValidateSelection({
              bookingId: variables.bookingId,
              tableIds: variables.tableIds,
              requireAdjacency: variables.requireAdjacency,
              excludeHoldId: variables.excludeHoldId,
              contextVersion: manualContext?.contextVersion ?? '',
            });
            setValidationResult(result);
          } catch (validationError) {
            const message =
              validationError instanceof Error ? validationError.message : 'Unable to validate selection';
            toast({ title: 'Validation failed', description: message, variant: 'destructive' });
          }
        }
        setUserModifiedSelection(true);
        const selectionKey = Array.isArray(variables?.tableIds)
          ? [...variables.tableIds].sort().join(',')
          : null;
        setLastHoldKey(selectionKey);
        return;
      }

      const code = (error as any)?.code ?? null;
      const rawDetails = (error as any)?.details ?? null;
      let details: any = rawDetails;
      if (typeof rawDetails === 'string') {
        try { details = JSON.parse(rawDetails); } catch { /* ignore */ }
      }
      const message = error instanceof Error ? error.message : 'Unable to place hold';
      toast({ title: 'Hold failed', description: message, variant: 'destructive' });
      setLastApiError({ scope: 'hold', code, message, details });
    },
  });

  const validateMutation = useMutation({
    mutationFn: (payload: ManualSelectionPayload) => bookingService.manualValidateSelection(payload),
    onSuccess: (result) => {
      setStaleContext(false);
      setValidationResult(result);
      setLastValidatedAt(Date.now());
    },
    onError: (error) => {
      if ((error as any)?.code === 'STALE_CONTEXT') {
        setStaleContext(true);
        return;
      }
      const code = (error as any)?.code ?? null;
      const rawDetails = (error as any)?.details ?? null;
      let details: any = rawDetails;
      if (typeof rawDetails === 'string') {
        try { details = JSON.parse(rawDetails); } catch { /* ignore */ }
      }
      const message = error instanceof Error ? error.message : 'Validation failed';
      toast({ title: 'Validation failed', description: message, variant: 'destructive' });
      setLastApiError({ scope: 'validate', code, message, details });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (holdId: string) => {
      const key =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      return bookingService.manualConfirmHold({
        holdId,
        bookingId: booking.id,
        idempotencyKey: key,
        requireAdjacency,
      });
    },
    onSuccess: (result) => {
      setStaleContext(false);
      const tableMap = new Map(manualContext?.tables.map((table) => [table.id, table]) ?? []);
      const nextAssignments = result.assignments.map((assignment) => {
        const meta = tableMap.get(assignment.tableId);
        return {
          groupId: null,
          capacitySum: meta?.capacity ?? null,
          members: [
            {
              tableId: assignment.tableId,
              tableNumber: meta?.tableNumber ?? assignment.tableId,
              capacity: meta?.capacity ?? null,
              section: meta?.section ?? null,
            },
          ],
        };
      });
      setAssignments(nextAssignments);
      setSelectedTables([]);
      setValidationResult(null);
      setLastValidatedAt(null);
      setUserModifiedSelection(false);
      setLastHoldKey(null);
      toast({ title: 'Tables assigned', description: 'Manual assignment confirmed successfully.' });
      void queryClient.invalidateQueries({ queryKey: queryKeys.manualAssign.context(booking.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.opsDashboard.summary(summary.restaurantId, summary.date ?? null) });
    },
    onError: (error) => {
      if ((error as any)?.code === 'STALE_CONTEXT') {
        setStaleContext(true);
        return;
      }
      const code = (error as any)?.code ?? null;
      const rawDetails = (error as any)?.details ?? null;
      let details: any = rawDetails;
      if (typeof rawDetails === 'string') {
        try { details = JSON.parse(rawDetails); } catch { /* ignore */ }
      }
      const message = error instanceof Error ? error.message : 'Assignment failed';
      toast({ title: 'Assignment failed', description: message, variant: 'destructive' });
      setLastApiError({ scope: 'confirm', code, message, details });
    },
  });

  const handleToggleTable = useCallback((tableId: string) => {
    setSelectedTables((prev) => {
      if (prev.includes(tableId)) {
        return prev.filter((id) => id !== tableId);
      }
      return [...prev, tableId];
    });
    setUserModifiedSelection(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSelectedTables([]);
      setValidationResult(null);
      setUserModifiedSelection(false);
      setLastHoldKey(null);
      setStaleContext(false);
      setActiveTab('overview');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const interval = setInterval(() => setCurrentTimestamp(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (!supportsTableAssignment && activeTab !== 'overview') {
      setActiveTab('overview');
    }
  }, [supportsTableAssignment, activeTab]);

  useEffect(() => {
    if (!manualContext) {
      return;
    }
    const defaultSelection = manualContext.activeHold?.tableIds?.length
      ? manualContext.activeHold.tableIds
      : manualContext.bookingAssignments;
    if (!userModifiedSelection) {
      const normalized = Array.from(new Set(defaultSelection));
      const nextKey = normalized.slice().sort().join(',');
      const currentKey = selectedTables.slice().sort().join(',');
      if (nextKey !== currentKey) {
        setSelectedTables(normalized);
      }
    }
    if (manualContext.activeHold) {
      setLastHoldKey(manualContext.activeHold.tableIds.slice().sort().join(','));
      if (!validationResult) {
        const metadata = manualContext.activeHold.metadata;
        const selectionMeta = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).selection : null;
        if (selectionMeta && typeof selectionMeta === 'object') {
          const summary = (selectionMeta as { summary?: ManualValidationResult['summary'] }).summary;
          if (summary) {
            setValidationResult({ ok: true, summary, checks: [] });
            setLastValidatedAt(Date.now());
          }
        }
      }
    }
  }, [manualContext, selectedTables, userModifiedSelection, validationResult]);

  useEffect(() => {
    if (!isOpen || !manualContext) {
      return;
    }
    if (selectedTables.length === 0) {
      setValidationResult(null);
      return;
    }
    const selectionKey = [...selectedTables].sort().join(',');
    if (selectionKey === lastHoldKey || holdMutation.isPending) {
      return;
    }
    const timeout = setTimeout(() => {
      holdMutation.mutate({
        bookingId: booking.id,
        tableIds: selectedTables,
        holdTtlSeconds: MANUAL_HOLD_TTL_SECONDS,
        requireAdjacency,
        contextVersion: manualContext?.contextVersion ?? '',
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [booking.id, holdMutation, isOpen, lastHoldKey, manualContext, requireAdjacency, selectedTables]);

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

  const normalizedAssignments = useMemo(() => expandAssignmentGroups(assignments), [assignments]);

  const selectionSummary = useMemo(() => {
    if (validationResult) {
      return validationResult.summary;
    }
    if (!manualContext) {
      return null;
    }
    if (selectedTables.length === 0) {
      return null;
    }
    const tableMap = new Map(manualContext.tables.map((table) => [table.id, table]));
    let totalCapacity = 0;
    const tableNumbers: string[] = [];
    let zoneId: string | null = null;
    let zoneMismatch = false;
    for (const tableId of selectedTables) {
      const meta = tableMap.get(tableId);
      if (!meta) {
        continue;
      }
      totalCapacity += meta.capacity ?? 0;
      tableNumbers.push(meta.tableNumber ?? meta.id);
      if (zoneId === null) {
        zoneId = meta.zoneId ?? null;
      } else if (zoneId !== meta.zoneId) {
        zoneMismatch = true;
      }
    }
    if (tableNumbers.length === 0) {
      return null;
    }
    if (zoneMismatch) {
      zoneId = null;
    }
    const partySize = manualContext.booking.partySize ?? 0;
    return {
      tableCount: tableNumbers.length,
      totalCapacity,
      slack: totalCapacity - partySize,
      zoneId,
      tableNumbers,
      partySize,
    };
  }, [manualContext, selectedTables, validationResult]);

  const validationChecks = validationResult?.checks ?? [];
  const hasBlockingErrors = validationChecks.some((check) => check.status === 'error');
  const activeHold = manualContext?.activeHold ?? null;
  const otherHolds = useMemo(
    () => (manualContext ? manualContext.holds.filter((hold) => hold.bookingId && hold.bookingId !== booking.id) : []),
    [manualContext, booking.id],
  );
  const selectedTableNumbers = useMemo(() => {
    if (!manualContext) {
      return [] as string[];
    }
    const mapping = new Map(manualContext.tables.map((table) => [table.id, table.tableNumber ?? table.id]));
    return selectedTables.map((tableId) => mapping.get(tableId) ?? tableId);
  }, [manualContext, selectedTables]);

  const slackLabel = selectionSummary ? formatSlack(selectionSummary.slack) : null;
  const hasSelection = selectedTables.length > 0;
  const selectionPartySize = selectionSummary?.partySize ?? manualContext?.booking.partySize ?? booking.partySize;
  const holdCountdownLabel = activeHold ? formatCountdownFromIso(activeHold.expiresAt, currentTimestamp) : null;
  const selectionDisabled = manualContextLoading || manualContextFetching || holdMutation.isPending || confirmMutation.isPending;
  const manualContextErrorMessage = manualContextError instanceof Error ? manualContextError.message : 'Unable to load manual assignment context.';
  const confirmDisabled = selectionDisabled || !hasSelection || !activeHold || hasBlockingErrors;
  let confirmDisabledReason: string | null = null;
  if (!hasSelection) {
    confirmDisabledReason = 'Select at least one table before confirming the assignment.';
  } else if (!activeHold) {
    confirmDisabledReason = 'Validate the selection to create a hold before confirming.';
  } else if (hasBlockingErrors) {
    confirmDisabledReason = 'Resolve blocking validation errors before confirming.';
  } else if (selectionDisabled && (manualContextLoading || manualContextFetching)) {
    confirmDisabledReason = 'Loading the latest availability…';
  }
  const validateDisabled = !hasSelection || selectionDisabled;
  const clearDisabled = !hasSelection || holdMutation.isPending || confirmMutation.isPending;

  const handleValidateSelection = useCallback(() => {
    if (selectedTables.length === 0) {
      toast({ title: 'Select tables', description: 'Choose one or more tables before validating.', variant: 'destructive' });
      return;
    }
    validateMutation.mutate({
      bookingId: booking.id,
      tableIds: selectedTables,
      requireAdjacency,
      excludeHoldId: manualContext?.activeHold?.id,
      contextVersion: manualContext?.contextVersion ?? '',
    });
  }, [booking.id, manualContext?.activeHold?.id, requireAdjacency, selectedTables, toast, validateMutation]);

  const handleConfirmSelection = useCallback(() => {
    if (!manualContext?.activeHold) {
      toast({ title: 'No active hold', description: 'Create a hold before confirming assignment.', variant: 'destructive' });
      return;
    }
    if (selectedTables.length === 0) {
      toast({ title: 'Select tables', description: 'Choose tables to assign before confirming.', variant: 'destructive' });
      return;
    }
    if (hasBlockingErrors) {
      toast({ title: 'Resolve validation errors', description: 'Fix blocking checks before assigning tables.', variant: 'destructive' });
      return;
    }
    confirmMutation.mutate(manualContext.activeHold.id);
  }, [confirmMutation, hasBlockingErrors, manualContext?.activeHold, selectedTables.length, toast]);

  const handleClearSelection = useCallback(async () => {
    if (manualContext?.activeHold) {
      try {
        await bookingService.manualReleaseHold({ holdId: manualContext.activeHold.id, bookingId: booking.id });
        await refetchManualContext();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to release hold';
        toast({ title: 'Release failed', description: message, variant: 'destructive' });
      }
    }
    setSelectedTables([]);
    setValidationResult(null);
    setLastValidatedAt(null);
    setUserModifiedSelection(true);
    setLastHoldKey(null);
  }, [booking.id, bookingService, manualContext?.activeHold, refetchManualContext, toast]);


  useEffect(() => {
    if (!isOpen) {
      setLocalPendingAction(null);
    }
  }, [isOpen]);

  const handleUnassignTable = async (tableId: string) => {
    if (!onUnassignTable) {
      return;
    }
    try {
      const updated = await onUnassignTable(tableId);
      setAssignments(updated);
      await manualContextQuery.refetch();
    } catch {
      // Toast handled by mutation hook
    }
  };

  const handleCheckInAction = useCallback(async () => {
    if (!onCheckIn) return;
    setLocalPendingAction('check-in');
    try {
      await onCheckIn();
    } finally {
      setLocalPendingAction(null);
    }
  }, [onCheckIn]);

  const handleCheckOutAction = useCallback(async () => {
    if (!onCheckOut) return;
    setLocalPendingAction('check-out');
    try {
      await onCheckOut();
    } finally {
      setLocalPendingAction(null);
    }
  }, [onCheckOut]);

  const handleMarkNoShowAction = useCallback(
    async (options?: { performedAt?: string | null; reason?: string | null }) => {
      if (!onMarkNoShow) return;
      setLocalPendingAction('no-show');
      try {
        await onMarkNoShow(options);
      } finally {
        setLocalPendingAction(null);
      }
    },
    [onMarkNoShow],
  );

  const handleUndoNoShowAction = useCallback(
    async (reason?: string | null) => {
      if (!onUndoNoShow) return;
      setLocalPendingAction('undo-no-show');
      try {
        await onUndoNoShow(reason);
      } finally {
        setLocalPendingAction(null);
      }
    },
    [onUndoNoShow],
  );

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
                {supportsTableAssignment ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full px-3 text-xs font-semibold"
                    onClick={() => setShowShortcuts(true)}
                  >
                    <Keyboard className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Shortcuts
                  </Button>
                ) : null}
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
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as BookingDetailsTab)}
            className="space-y-5 py-4"
          >
            <TabsList
              className={cn('grid w-full gap-2', supportsTableAssignment ? 'grid-cols-2' : 'grid-cols-1')}
            >
              <TabsTrigger value="overview" className="text-sm font-medium">
                Overview
              </TabsTrigger>
              {supportsTableAssignment ? (
                <TabsTrigger value="tables" className="text-sm font-medium">
                  Tables
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="overview" className="focus-visible:outline-none">
              <div className="space-y-6">
                <Card>
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-base">Quick actions</CardTitle>
                    <CardDescription>Record arrivals or no-shows to keep the team in sync.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
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
                      <Alert variant="destructive" className="rounded-xl border border-destructive/40">
                        <AlertTitle>Booking cancelled</AlertTitle>
                        <AlertDescription>Status changes are disabled for cancelled reservations.</AlertDescription>
                      </Alert>
                    ) : null}
                    {!supportsTableAssignment ? (
                      <Alert className="rounded-xl border border-slate-200 bg-slate-50">
                        <AlertTitle>Past service date</AlertTitle>
                        <AlertDescription>Table assignment changes are locked after the service has passed.</AlertDescription>
                      </Alert>
                    ) : null}
                  </CardContent>
                </Card>

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
                    <h3 className="text-sm font-semibold text-foreground">Booking notes</h3>
                    <p className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-sm text-foreground">
                      {booking.notes}
                    </p>
                  </section>
                ) : null}

                {(booking.loyaltyTier ||
                  booking.allergies ||
                  booking.dietaryRestrictions ||
                  booking.seatingPreference ||
                  booking.profileNotes ||
                  booking.marketingOptIn !== null) ? (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Guest profile</h3>
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
                          <AlertTriangle className="mt-0.5 h-4 w-4 text-orange-600" aria-hidden />
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
                          <Users className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
                          <div className="flex-1">
                            <span className="text-sm text-muted-foreground">Dietary restrictions:</span>
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
                            <span className="text-sm text-muted-foreground">Seating preference:</span>
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
                          <span className="text-sm font-medium text-foreground">Profile notes:</span>
                          <p className="text-sm text-muted-foreground">{booking.profileNotes}</p>
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </div>
            </TabsContent>

            {supportsTableAssignment ? (
              <TabsContent value="tables" className="focus-visible:outline-none">
                <div className="space-y-6">
                  <section className="space-y-6 rounded-2xl border border-border/60 bg-muted/10 px-4 py-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Manual assignment</h3>
                        <p className="text-xs text-muted-foreground">
                          Choose tables on the floor plan, review checks, then confirm to lock them in.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="only-available-switch" className="text-xs text-muted-foreground">
                          Only show available
                        </Label>
                        <Switch
                          id="only-available-switch"
                          checked={onlyAvailable}
                          onCheckedChange={setOnlyAvailable}
                          aria-label="Toggle only showing available tables"
                        />
                      </div>
                    </div>

                    {manualContextIsError ? (
                      <Alert variant="destructive" className="rounded-xl border border-destructive/40 bg-destructive/10">
                        <AlertTitle>Unable to load manual assignment</AlertTitle>
                        <AlertDescription>{manualContextErrorMessage}</AlertDescription>
                      </Alert>
                    ) : (
                      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
                        <div className="relative space-y-3">
                          <TableFloorPlan
                            bookingId={booking.id}
                            tables={manualContext?.tables ?? []}
                            holds={manualContext?.holds ?? []}
                            conflicts={manualContext?.conflicts ?? []}
                            bookingAssignments={manualContext?.bookingAssignments ?? []}
                            selectedTableIds={selectedTables}
                            onToggle={handleToggleTable}
                            onlyAvailable={onlyAvailable}
                            disabled={selectionDisabled}
                          />
                          {manualContextLoading || manualContextFetching ? (
                            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/70 backdrop-blur-sm">
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
                            </div>
                          ) : null}
                        </div>
                        <div className="space-y-4">
                          <ManualAssignmentSummaryCard
                            summary={selectionSummary}
                            slackLabel={slackLabel}
                            partySize={selectionPartySize}
                            tableNumbers={selectedTableNumbers}
                            requireAdjacency={requireAdjacency}
                            onAdjacencyChange={setRequireAdjacency}
                            isLoading={manualContextLoading && !manualContext}
                            activeHold={activeHold}
                            holdCountdownLabel={holdCountdownLabel}
                            otherHolds={otherHolds}
                          />
                          {staleContext ? (
                            <Alert variant="destructive" role="alert" aria-live="polite">
                              <AlertTriangle className="h-4 w-4" aria-hidden />
                              <AlertTitle>Refresh needed — context changed</AlertTitle>
                              <AlertDescription>
                                The booking context has changed (holds or assignments). Please refresh to continue.
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="ml-2"
                                  onClick={async () => {
                                    try {
                                      await refetchManualContext();
                                      setStaleContext(false);
                                    } catch {
                                      // swallow errors; toast is handled elsewhere
                                    }
                                  }}
                                >
                                  Refresh
                                </Button>
                              </AlertDescription>
                            </Alert>
                          ) : null}
                          {lastApiError ? (
                            <Alert variant="destructive" className="rounded-xl border border-destructive/40 bg-destructive/10">
                              <AlertTriangle className="h-4 w-4" aria-hidden />
                              <AlertTitle>
                                {lastApiError.code ? `${lastApiError.code}` : 'Manual action failed'}
                              </AlertTitle>
                              <AlertDescription>
                                <div className="space-y-2">
                                  <p className="text-sm">{lastApiError.message}</p>
                                  {lastApiError.details ? (
                                    <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                                      {JSON.stringify(lastApiError.details, null, 2)}
                                    </pre>
                                  ) : null}
                                </div>
                              </AlertDescription>
                            </Alert>
                          ) : null}

                          <ManualAssignmentValidationPanel
                            checks={validationChecks}
                            lastValidatedAt={lastValidatedAt}
                            isPending={holdMutation.isPending || validateMutation.isPending}
                            hasSelection={hasSelection}
                          />
                          <ManualAssignmentActions
                            onValidate={handleValidateSelection}
                            onConfirm={handleConfirmSelection}
                            onClear={handleClearSelection}
                            disableValidate={validateDisabled}
                            disableConfirm={confirmDisabled}
                            disableClear={clearDisabled}
                            validating={holdMutation.isPending || validateMutation.isPending}
                            confirming={confirmMutation.isPending}
                            confirmDisabledReason={confirmDisabledReason}
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-foreground">Assigned tables</h4>
                      {normalizedAssignments.length > 0 ? (
                        normalizedAssignments.map((assignment) => {
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
                                disabled={isUnassigning || confirmMutation.isPending}
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
                        })
                      ) : (
                        <p className="text-sm text-muted-foreground">No tables assigned yet.</p>
                      )}
                    </div>
                  </section>
                </div>
              </TabsContent>
            ) : null}
          </Tabs>
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
