'use client';

import { DateTime } from 'luxon';
import { useMemo } from 'react';

import { BookingDetailsDialog } from '@/components/features/dashboard/BookingDetailsDialog';
import { isTableAssignmentAllowed } from '@/lib/ops/table-assignment-policy';
import { getTodayInTimezone } from '@/lib/utils/datetime';
import { useBookingLifecycle } from '@src/hooks/ops/useBookingLifecycle';
import { useOpsBookingDialogBundle } from '@src/hooks/ops/useOpsBookingDialogBundle';
import { useOpsCancelBooking } from '@src/hooks/ops/useOpsCancelBooking';
import { useMinimumDelay } from '@src/hooks/use-minimum-delay';

import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';
import type { OpsBookingListItem } from '@/types/ops';

type BookingSource = OpsBookingListItem | BookingDTO;

const deriveTimeFromIso = (iso: string | null | undefined, timezone: string): string | null => {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { zone: timezone });
  if (!dt.isValid) return null;
  return dt.toFormat('HH:mm');
};

function normalizeBooking(source: BookingSource, timezone: string): OpsTodayBooking {
  const tableAssignments =
    'tableAssignments' in source && Array.isArray(source.tableAssignments)
      ? (source.tableAssignments ?? [])
      : [];

  const startTime =
    ('startTime' in source ? source.startTime : null) ??
    deriveTimeFromIso(source.startIso, timezone);
  const endTime =
    ('endTime' in source ? source.endTime : null) ?? deriveTimeFromIso(source.endIso, timezone);

  const requiresTableAssignment =
    'requiresTableAssignment' in source && typeof source.requiresTableAssignment === 'boolean'
      ? source.requiresTableAssignment
      : tableAssignments.length === 0 &&
        source.status !== 'cancelled' &&
        source.status !== 'no_show';

  return {
    id: source.id,
    status: source.status as OpsTodayBooking['status'],
    startTime,
    endTime,
    partySize: source.partySize,
    customerName: source.customerName ?? '',
    customerEmail: source.customerEmail ?? null,
    customerPhone: source.customerPhone ?? null,
    notes: source.notes ?? null,
    reference: 'reference' in source ? (source.reference ?? null) : null,
    details:
      'details' in source
        ? ((source.details as Record<string, unknown> | null | undefined) ?? null)
        : null,
    source: 'source' in source ? (source.source ?? null) : null,
    profileNotes: 'profileNotes' in source ? (source.profileNotes ?? null) : null,
    allergies: 'allergies' in source ? (source.allergies ?? null) : null,
    dietaryRestrictions:
      'dietaryRestrictions' in source ? (source.dietaryRestrictions ?? null) : null,
    seatingPreference: 'seatingPreference' in source ? (source.seatingPreference ?? null) : null,
    marketingOptIn: 'marketingOptIn' in source ? (source.marketingOptIn ?? null) : null,
    tableAssignments,
    requiresTableAssignment,
    checkedInAt: 'checkedInAt' in source ? (source.checkedInAt ?? null) : null,
    checkedOutAt: 'checkedOutAt' in source ? (source.checkedOutAt ?? null) : null,
  } satisfies OpsTodayBooking;
}

function normalizeBookingSource(source: BookingSource, fallbackTimezone: string) {
  const timezone =
    (source as OpsBookingListItem).restaurantTimezone ??
    source.restaurantTimezone ??
    fallbackTimezone;
  const booking = normalizeBooking(source, timezone ?? fallbackTimezone);
  const restaurantId = (source as OpsBookingListItem).restaurantId ?? source.restaurantId ?? null;
  const startIso = source.startIso ?? null;

  return { booking, restaurantId, timezone: timezone ?? fallbackTimezone, startIso };
}

type BookingDetailsDialogWrapperProps = {
  bookingId: string | null;
  initialData: BookingDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BookingDetailsDialogWrapper({
  bookingId,
  initialData,
  open,
  onOpenChange,
}: BookingDetailsDialogWrapperProps) {
  const activeBookingId = open ? bookingId : null;
  const {
    data: dialogBundle,
    isLoading,
    isError,
    error,
    refetch,
  } = useOpsBookingDialogBundle(activeBookingId);
  const fetchedBooking = dialogBundle?.booking ?? null;
  const bookingSource = fetchedBooking ?? initialData ?? null;
  const showSkeleton = useMinimumDelay(isLoading && !bookingSource, {
    delayMs: 120,
    minDurationMs: 250,
  });
  const normalized = useMemo(() => {
    if (!bookingSource) return null;
    const fallbackTz = initialData?.restaurantTimezone ?? 'UTC';
    return normalizeBookingSource(bookingSource, fallbackTz);
  }, [bookingSource, initialData?.restaurantTimezone]);

  const booking = normalized?.booking ?? null;
  const restaurantId = normalized?.restaurantId ?? null;
  const timezone = normalized?.timezone ?? 'UTC';
  const startIso = normalized?.startIso ?? null;

  const { cancel, isPending: isCancelPending } = useOpsCancelBooking();

  const summary = useMemo<OpsTodayBookingsSummary | null>(() => {
    if (!booking || !restaurantId) return null;

    const derivedDate = startIso
      ? DateTime.fromISO(startIso, { zone: timezone }).toISODate()
      : null;

    const date = derivedDate ?? getTodayInTimezone(timezone);

    return {
      meta: {
        date,
        timezone,
        restaurantId,
      },
      date,
      timezone,
      restaurantId,
      totals: {
        total: 0,
        confirmed: 0,
        completed: 0,
        pending: 0,
        cancelled: 0,
        noShow: 0,
        upcoming: 0,
        covers: 0,
      },
      bookings: [],
    };
  }, [booking, restaurantId, startIso, timezone]);

  const { run, pendingActions } = useBookingLifecycle();
  const { allowTableAssignments, isToday } = useMemo(() => {
    if (!summary) return { allowTableAssignments: false, isToday: false };
    const today = getTodayInTimezone(summary.timezone);
    return {
      allowTableAssignments: isTableAssignmentAllowed({
        status: booking?.status ?? null,
        bookingDate: summary.date,
        timezone: summary.timezone,
      }),
      isToday: summary.date === today,
    };
  }, [booking?.status, summary]);

  // Handlers resolve (never reject): the canonical hooks own toasts, cache sync and conflict
  // refresh, so the dialog issues no follow-up refetch of its own.
  const handleCheckIn = async () => {
    if (!restaurantId || !bookingId) return;
    await run({ action: 'check-in', restaurantId, bookingId, targetDate: summary?.date ?? null });
  };

  const handleCheckOut = async () => {
    if (!restaurantId || !bookingId) return;
    await run({ action: 'check-out', restaurantId, bookingId, targetDate: summary?.date ?? null });
  };

  const handleMarkNoShow = async (options?: {
    performedAt?: string | null;
    reason?: string | null;
  }) => {
    if (!restaurantId || !bookingId) return;
    await run({
      action: 'no-show',
      restaurantId,
      bookingId,
      targetDate: summary?.date ?? null,
      performedAt: options?.performedAt ?? null,
      reason: options?.reason ?? null,
    });
  };

  const handleUndoNoShow = async (reason?: string | null) => {
    if (!restaurantId || !bookingId) return;
    await run({
      action: 'undo-no-show',
      restaurantId,
      bookingId,
      targetDate: summary?.date ?? null,
      reason: reason ?? null,
    });
  };

  const pendingLifecycleAction = bookingId ? (pendingActions[bookingId]?.action ?? null) : null;

  const handleCancel = async (): Promise<boolean> => {
    if (!restaurantId || !bookingId) return false;
    const outcome = await cancel({ bookingId, restaurantId });
    return outcome.status === 'done';
  };

  if (!open) return null;
  return (
    <BookingDetailsDialog
      booking={booking}
      summary={summary}
      isLoading={showSkeleton}
      errorMessage={isError ? (error?.message ?? 'Unable to load booking.') : null}
      onRetry={() => refetch()}
      onCheckIn={handleCheckIn}
      onCheckOut={handleCheckOut}
      onMarkNoShow={handleMarkNoShow}
      onUndoNoShow={handleUndoNoShow}
      onCancel={handleCancel}
      pendingLifecycleAction={pendingLifecycleAction}
      cancelPending={isCancelPending(bookingId)}
      allowTableAssignments={allowTableAssignments}
      // The bundle hook seeds the assignment-context cache. Keep the legacy
      // assignment hook network-disabled so opening the dialog stays one
      // round-trip.
      tableAssignmentQueryEnabled={false}
      tableAssignmentRealtime={false}
      // Pass controlled props
      open={open}
      onOpenChange={onOpenChange}
      isToday={isToday}
    />
  );
}
