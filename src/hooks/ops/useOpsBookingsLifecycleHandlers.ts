'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useOpsBookingLifecycleActions } from '@/hooks/ops/useOpsBookingStatusActions';
import { track } from '@/lib/analytics';
import { HttpError } from '@/lib/http/errors';

import type { BookingAction } from '@/components/features/booking-state-machine';

export type UseOpsBookingsLifecycleHandlersParams = {
  restaurantId: string | null;
  targetDate: string | null;
  isOnline: boolean;
  getBookingLabel: (bookingId: string) => string;
};

export function useOpsBookingsLifecycleHandlers({
  restaurantId,
  targetDate,
  isOnline,
  getBookingLabel,
}: UseOpsBookingsLifecycleHandlersParams) {
  const bookingLifecycleMutations = useOpsBookingLifecycleActions();

  const [pendingActionsByBookingId, setPendingActionsByBookingId] = useState<
    Record<string, BookingAction | null>
  >({});

  const setPendingBookingAction = useCallback((bookingId: string, action: BookingAction) => {
    setPendingActionsByBookingId((current) => ({ ...current, [bookingId]: action }));
  }, []);

  const clearPendingBookingAction = useCallback((bookingId: string) => {
    setPendingActionsByBookingId((current) => {
      if (!current[bookingId]) return current;
      const next = { ...current };
      delete next[bookingId];
      return next;
    });
  }, []);

  const onUndoNoShow = useCallback(
    async (bookingId: string, reason?: string | null) => {
      if (!restaurantId) return;
      const guestLabel = getBookingLabel(bookingId);

      if (!isOnline) {
        bookingLifecycleMutations.undoNoShow.mutate({
          restaurantId,
          bookingId,
          reason: reason ?? null,
          targetDate,
        });
        toast.message(`Queued undo no-show: ${guestLabel}`, {
          description: 'This will sync automatically once you reconnect.',
        });
        return;
      }

      setPendingBookingAction(bookingId, 'undo-no-show');
      try {
        await bookingLifecycleMutations.undoNoShow.mutateAsync({
          restaurantId,
          bookingId,
          reason: reason ?? null,
          targetDate,
        });
        toast.success(`Undo no-show: ${guestLabel}`);
      } catch (error) {
        if (error instanceof HttpError && error.status === 409) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unable to undo no-show.';
        toast.error('Unable to undo no-show', { description: message });
      } finally {
        clearPendingBookingAction(bookingId);
      }
    },
    [
      restaurantId,
      targetDate,
      bookingLifecycleMutations.undoNoShow,
      clearPendingBookingAction,
      getBookingLabel,
      isOnline,
      setPendingBookingAction,
    ],
  );

  const onMarkNoShow = useCallback(
    async (bookingId: string, options?: { performedAt?: string | null; reason?: string | null }) => {
      if (!restaurantId) return;
      const guestLabel = getBookingLabel(bookingId);

      if (!isOnline) {
        bookingLifecycleMutations.markNoShow.mutate({
          restaurantId,
          bookingId,
          performedAt: options?.performedAt ?? null,
          reason: options?.reason ?? null,
          targetDate,
        });
        toast.message(`Queued no-show: ${guestLabel}`, {
          description: 'This will sync automatically once you reconnect.',
        });
        return;
      }

      setPendingBookingAction(bookingId, 'no-show');
      try {
        await bookingLifecycleMutations.markNoShow.mutateAsync({
          restaurantId,
          bookingId,
          performedAt: options?.performedAt ?? null,
          reason: options?.reason ?? null,
          targetDate,
        });
        track('booking_no_show', {
          booking_id: bookingId,
          restaurant_id: restaurantId,
          date: targetDate,
          is_online: isOnline,
        });
        toast.success(`Marked no-show: ${guestLabel}`, {
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: () => {
              void onUndoNoShow(bookingId);
            },
          },
        });
      } catch (error) {
        if (error instanceof HttpError && error.status === 409) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unable to mark no-show.';
        toast.error('Unable to mark no-show', { description: message });
      } finally {
        clearPendingBookingAction(bookingId);
      }
    },
    [
      restaurantId,
      targetDate,
      bookingLifecycleMutations.markNoShow,
      clearPendingBookingAction,
      getBookingLabel,
      isOnline,
      onUndoNoShow,
      setPendingBookingAction,
    ],
  );

  const onCheckIn = useCallback(
    async (bookingId: string) => {
      if (!restaurantId) return;
      const guestLabel = getBookingLabel(bookingId);

      if (!isOnline) {
        bookingLifecycleMutations.checkIn.mutate({
          restaurantId,
          bookingId,
          targetDate,
        });
        toast.message(`Queued seat: ${guestLabel}`, {
          description: 'This will sync automatically once you reconnect.',
        });
        return;
      }

      setPendingBookingAction(bookingId, 'check-in');
      try {
        await bookingLifecycleMutations.checkIn.mutateAsync({
          restaurantId,
          bookingId,
          targetDate,
        });
        track('booking_check_in', {
          booking_id: bookingId,
          restaurant_id: restaurantId,
          date: targetDate,
          is_online: isOnline,
        });
        toast.success(`Seated: ${guestLabel}`);
      } catch (error) {
        if (error instanceof HttpError && error.status === 409) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unable to seat guest.';
        toast.error('Unable to seat guest', { description: message });
      } finally {
        clearPendingBookingAction(bookingId);
      }
    },
    [
      restaurantId,
      targetDate,
      bookingLifecycleMutations.checkIn,
      clearPendingBookingAction,
      getBookingLabel,
      isOnline,
      setPendingBookingAction,
    ],
  );

  const onCheckOut = useCallback(
    async (bookingId: string) => {
      if (!restaurantId) return;
      const guestLabel = getBookingLabel(bookingId);

      if (!isOnline) {
        bookingLifecycleMutations.checkOut.mutate({
          restaurantId,
          bookingId,
          targetDate,
        });
        toast.message(`Queued finish: ${guestLabel}`, {
          description: 'This will sync automatically once you reconnect.',
        });
        return;
      }

      setPendingBookingAction(bookingId, 'check-out');
      try {
        await bookingLifecycleMutations.checkOut.mutateAsync({
          restaurantId,
          bookingId,
          targetDate,
        });
        track('booking_check_out', {
          booking_id: bookingId,
          restaurant_id: restaurantId,
          date: targetDate,
          is_online: isOnline,
        });
        track('booking_completed', {
          booking_id: bookingId,
          restaurant_id: restaurantId,
          date: targetDate,
          is_online: isOnline,
        });
        toast.success(`Finished: ${guestLabel}`);
      } catch (error) {
        if (error instanceof HttpError && error.status === 409) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unable to finish booking.';
        toast.error('Unable to finish booking', { description: message });
      } finally {
        clearPendingBookingAction(bookingId);
      }
    },
    [
      restaurantId,
      targetDate,
      bookingLifecycleMutations.checkOut,
      clearPendingBookingAction,
      getBookingLabel,
      isOnline,
      setPendingBookingAction,
    ],
  );

  return {
    pendingActionsByBookingId,
    onCheckIn,
    onCheckOut,
    onMarkNoShow,
    onUndoNoShow,
  } as const;
}
