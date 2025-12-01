'use client';

import { DateTime } from 'luxon';
import { useMemo } from 'react';

import { BookingDetailsDialog } from '@/components/features/dashboard/BookingDetailsDialog';
import { useOpsTableAssignmentActions } from '@/hooks';
import { useOpsBooking } from '@/hooks/ops/useOpsBooking';
import { useOpsBookingLifecycleActions } from '@/hooks/ops/useOpsBookingStatusActions';

import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

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
  const { data: fetchedBooking } = useOpsBooking(open ? bookingId : null);
  
  const booking = useMemo(() => {
    // Prefer fetched details, fallback to initialData (mapped to OpsTodayBooking shape roughly)
    if (fetchedBooking) return fetchedBooking as unknown as OpsTodayBooking;
    if (initialData) {
            // Minimal mapping for initial render
            return {
                id: initialData.id,
                status: initialData.status as OpsTodayBooking['status'],
                partySize: initialData.partySize,
                customerName: initialData.customerName ?? '',
                customerEmail: initialData.customerEmail ?? null,
                customerPhone: initialData.customerPhone ?? null,
                notes: initialData.notes ?? null,
                // These fields are only available in the fetched (full) booking.
                // Initialize to null/empty as per OpsTodayBooking structure.
                startTime: null, 
                endTime: null,
                reference: null,
                details: null,
                source: null,
                loyaltyTier: null,
                loyaltyPoints: null,
                profileNotes: null,
                allergies: null,
                dietaryRestrictions: null,
                seatingPreference: null,
                marketingOptIn: null,
                tableAssignments: [],
                requiresTableAssignment: false,
                checkedInAt: null,
                checkedOutAt: null,
            } as OpsTodayBooking;    }
    return null;
  }, [fetchedBooking, initialData]);

  const restaurantId = booking?.details?.restaurantId as string ?? initialData?.restaurantId ?? null;
  const timezone = initialData?.restaurantTimezone ?? 'UTC';
  const startIso = initialData?.startIso ?? fetchedBooking?.startIso ?? null;
  
  const summary = useMemo<OpsTodayBookingsSummary | null>(() => {
    if (!booking || !restaurantId) return null;
    
    // Derive date from startIso or current date if missing
    let date = new Date().toISOString().split('T')[0];
    
    if (startIso) {
        date = DateTime.fromISO(startIso, { zone: timezone }).toISODate() ?? date;
    }

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
      bookings: [], // Not needed for the dialog itself
    };
  }, [booking, restaurantId, timezone, startIso]);

  const { checkIn, checkOut, markNoShow, undoNoShow } = useOpsBookingLifecycleActions();
  const assignmentDate = summary?.date ?? null;
  const tableAssignmentActions = useOpsTableAssignmentActions({ restaurantId, date: assignmentDate });

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

  // Table assignment handlers
  const handleAssignTable = async (tableId: string) => {
    if (!bookingId) throw new Error('No booking ID');
    const result = await tableAssignmentActions.assignTable.mutateAsync({ bookingId, tableId });
    return result.tableAssignments;
  };

  const handleUnassignTable = async (tableId: string) => {
    if (!bookingId) throw new Error('No booking ID');
    const result = await tableAssignmentActions.unassignTable.mutateAsync({ bookingId, tableId });
    return result.tableAssignments;
  };

  const tableActionState = useMemo(() => {
    if (tableAssignmentActions.assignTable.isPending) {
      const variables = tableAssignmentActions.assignTable.variables;
      return {
        type: 'assign' as const,
        tableId: variables?.tableId ?? null,
      };
    }
    if (tableAssignmentActions.unassignTable.isPending) {
      const variables = tableAssignmentActions.unassignTable.variables;
      return {
        type: 'unassign' as const,
        tableId: variables?.tableId ?? null,
      };
    }
    return null;
  }, [
    tableAssignmentActions.assignTable.isPending,
    tableAssignmentActions.assignTable.variables,
    tableAssignmentActions.unassignTable.isPending,
    tableAssignmentActions.unassignTable.variables,
  ]);

  // Determine lifecycle pending state
  const pendingLifecycleAction = useMemo(() => {
    if (checkIn.isPending && checkIn.variables?.bookingId === bookingId) return 'check-in';
    if (checkOut.isPending && checkOut.variables?.bookingId === bookingId) return 'check-out';
    if (markNoShow.isPending && markNoShow.variables?.bookingId === bookingId) return 'no-show';
    if (undoNoShow.isPending && undoNoShow.variables?.bookingId === bookingId) return 'undo-no-show';
    return null;
  }, [checkIn.isPending, checkIn.variables, checkOut.isPending, checkOut.variables, markNoShow.isPending, markNoShow.variables, undoNoShow.isPending, undoNoShow.variables, bookingId]);

  if (!open) return null;

  // If we have basic data, we can render. 
  // But ideally we wait for fetch to complete for full "Details". 
  // However, BookingDetailsDialog handles loading states gracefully? 
  // Actually it assumes data is present.
  // We can show a loader or render what we have.
  
  // Since `useOpsBooking` is enabled only when `open` is true, it starts fetching on open.
  // We can conditionally render or pass loading state if the dialog supports it.
  // The dialog doesn't seem to have a loading prop for the whole content.
  // But we can rely on `fetchedBooking` being null initially.
  
  if (!booking || !summary) return null;

  // We need to make sure `BookingDetailsDialog` is actually open.
  // It uses an internal `isOpen` state if used as a trigger, but here we are wrapping it.
  // Wait, `BookingDetailsDialog` in `components/features/dashboard/BookingDetailsDialog.tsx`
  // has `DialogTrigger` and internal `isOpen` state.
  
  // This is a problem. `BookingDetailsDialog` is designed to be a button that opens a dialog.
  // I want to control it externally from `OpsBookingsClient`.
  
  // I need to modify `BookingDetailsDialog` to accept `open` and `onOpenChange` props to control it controlled-ly.
  // OR I render it such that it's always "open" when this wrapper is rendered?
  // No, `Dialog` component inside `BookingDetailsDialog` handles the visibility.
  
  // Let's check `BookingDetailsDialog.tsx` again.
  // It has: `const [isOpen, setIsOpen] = useState(false);`
  // And `<Dialog open={isOpen} onOpenChange={setIsOpen}>`
  
  // I cannot easily control it from outside without modifying it.
  // I should modify `BookingDetailsDialog.tsx` to accept `open` and `onOpenChange` as optional props (controlled mode).
  
  return (
    <BookingDetailsDialog
      booking={booking}
      summary={summary}
      allowTableAssignments={true} // Always allow for ops view? Or check date?
      onCheckIn={handleCheckIn}
      onCheckOut={handleCheckOut}
      onMarkNoShow={handleMarkNoShow}
      onUndoNoShow={handleUndoNoShow}
      pendingLifecycleAction={pendingLifecycleAction}
      onAssignTable={handleAssignTable}
      onUnassignTable={handleUnassignTable}
      tableActionState={tableActionState}
      // Pass controlled props
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
