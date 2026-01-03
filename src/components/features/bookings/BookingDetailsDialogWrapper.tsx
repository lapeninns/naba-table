'use client';

import { DateTime } from 'luxon';
import { useMemo } from 'react';

import { BookingDetailsDialog } from '@/components/features/dashboard/BookingDetailsDialog';
import { useOpsBooking } from '@/hooks/ops/useOpsBooking';
import { useOpsBookingLifecycleActions } from '@/hooks/ops/useOpsBookingStatusActions';
import { useOpsCancelBooking } from '@/hooks/ops/useOpsCancelBooking';
import { getTodayInTimezone } from '@/lib/utils/datetime';

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
  const tableAssignments = 'tableAssignments' in source && Array.isArray(source.tableAssignments)
    ? source.tableAssignments ?? []
    : [];

  const startTime = ('startTime' in source ? source.startTime : null) ?? deriveTimeFromIso(source.startIso, timezone);
  const endTime = ('endTime' in source ? source.endTime : null) ?? deriveTimeFromIso(source.endIso, timezone);

  const requiresTableAssignment =
    'requiresTableAssignment' in source && typeof source.requiresTableAssignment === 'boolean'
      ? source.requiresTableAssignment
      : tableAssignments.length === 0 && source.status !== 'cancelled' && source.status !== 'no_show';

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
    reference: 'reference' in source ? source.reference ?? null : null,
    details: 'details' in source ? (source.details as Record<string, unknown> | null | undefined) ?? null : null,
    source: 'source' in source ? source.source ?? null : null,
    loyaltyTier: 'loyaltyTier' in source ? source.loyaltyTier ?? null : null,
    loyaltyPoints: 'loyaltyPoints' in source ? source.loyaltyPoints ?? null : null,
    profileNotes: 'profileNotes' in source ? source.profileNotes ?? null : null,
    allergies: 'allergies' in source ? source.allergies ?? null : null,
    dietaryRestrictions: 'dietaryRestrictions' in source ? source.dietaryRestrictions ?? null : null,
    seatingPreference: 'seatingPreference' in source ? source.seatingPreference ?? null : null,
    marketingOptIn: 'marketingOptIn' in source ? source.marketingOptIn ?? null : null,
    tableAssignments,
    requiresTableAssignment,
    checkedInAt: 'checkedInAt' in source ? source.checkedInAt ?? null : null,
    checkedOutAt: 'checkedOutAt' in source ? source.checkedOutAt ?? null : null,
  } satisfies OpsTodayBooking;
}

function normalizeBookingSource(source: BookingSource, fallbackTimezone: string) {
  const timezone = (source as OpsBookingListItem).restaurantTimezone ?? source.restaurantTimezone ?? fallbackTimezone;
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
  const { data: fetchedBooking, isLoading, isError, error, refetch } = useOpsBooking(open ? bookingId : null);
  const bookingSource = fetchedBooking ?? initialData ?? null;
  const normalized = useMemo(() => {
    if (!bookingSource) return null;
    const fallbackTz = initialData?.restaurantTimezone ?? 'UTC';
    return normalizeBookingSource(bookingSource, fallbackTz);
  }, [bookingSource, initialData?.restaurantTimezone]);

  const booking = normalized?.booking ?? null;
  const restaurantId = normalized?.restaurantId ?? null;
  const timezone = normalized?.timezone ?? 'UTC';
  const startIso = normalized?.startIso ?? null;

  const cancelBooking = useOpsCancelBooking();

  const summary = useMemo<OpsTodayBookingsSummary | null>(() => {
    if (!booking || !restaurantId) return null;

    const derivedDate = startIso
      ? DateTime.fromISO(startIso, { zone: timezone }).toISODate()
      : null;

    const date = derivedDate ?? getTodayInTimezone(timezone);

    return {
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

  const { checkIn, checkOut, markNoShow, undoNoShow } = useOpsBookingLifecycleActions();
  const allowTableAssignments = useMemo(() => {
    if (!summary) return false;
    const today = getTodayInTimezone(summary.timezone);
    return summary.date >= today;
  }, [summary]);

  // Lifecycle handlers
  const handleCheckIn = async () => {
    if (!restaurantId || !bookingId) return;
    await checkIn.mutateAsync({ restaurantId, bookingId, targetDate: null });
  };

  const handleCheckOut = async () => {
    if (!restaurantId || !bookingId) return;
    await checkOut.mutateAsync({ restaurantId, bookingId, targetDate: null });
  };

  const handleMarkNoShow = async (options?: { performedAt?: string | null; reason?: string | null }) => {
    if (!restaurantId || !bookingId) return;
    await markNoShow.mutateAsync({
      restaurantId,
      bookingId,
      targetDate: null,
      performedAt: options?.performedAt ?? null,
      reason: options?.reason ?? null,
    });
  };

  const handleUndoNoShow = async (reason?: string | null) => {
    if (!restaurantId || !bookingId) return;
    await undoNoShow.mutateAsync({
      restaurantId,
      bookingId,
      targetDate: null,
      reason: reason ?? null,
    });
  };

  // Determine lifecycle pending state
  const pendingLifecycleAction = useMemo(() => {
    if (checkIn.isPending && checkIn.variables?.bookingId === bookingId) return 'check-in';
    if (checkOut.isPending && checkOut.variables?.bookingId === bookingId) return 'check-out';
    if (markNoShow.isPending && markNoShow.variables?.bookingId === bookingId) return 'no-show';
    if (undoNoShow.isPending && undoNoShow.variables?.bookingId === bookingId) return 'undo-no-show';
    return null;
  }, [checkIn.isPending, checkIn.variables, checkOut.isPending, checkOut.variables, markNoShow.isPending, markNoShow.variables, undoNoShow.isPending, undoNoShow.variables, bookingId]);

  const handleCancel = async () => {
    if (!restaurantId || !bookingId) return;
    await cancelBooking.mutateAsync({
      bookingId,
      restaurantId,
      targetDate: summary?.date ?? null,
    });
  };

  if (!open) return null;
  return (
    <BookingDetailsDialog
      booking={booking}
      summary={summary}
      isLoading={isLoading}
      errorMessage={isError ? error?.message ?? 'Unable to load booking.' : null}
      onRetry={() => refetch()}
      onCheckIn={handleCheckIn}
      onCheckOut={handleCheckOut}
      onMarkNoShow={handleMarkNoShow}
      onUndoNoShow={handleUndoNoShow}
      onCancel={handleCancel}
      pendingLifecycleAction={pendingLifecycleAction}
      cancelPending={cancelBooking.isPending}
      allowTableAssignments={allowTableAssignments}
      // Pass controlled props
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
