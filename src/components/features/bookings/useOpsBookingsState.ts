'use client';

import { useCallback, useEffect, useMemo } from 'react';

import { OPS_LISTABLE_STATUSES } from '@/components/features/bookings/opsBookingsConstants';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useOpsBookingsDialogs } from '@/hooks/ops/useOpsBookingsDialogs';
import { useOpsBookingsLifecycleHandlers } from '@/hooks/ops/useOpsBookingsLifecycleHandlers';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES } from '@/utils/ops/bookings';

import { buildOpsBookingsCardRows } from './opsBookingsSelectors';
import { useOpsBookingsDataState } from './useOpsBookingsDataState';
import { useOpsBookingsQueryState } from './useOpsBookingsQueryState';

import type { OpsBookingsClientStateParams } from './opsBookingsTypes';
import type { BookingDTO } from '@/hooks/useBookings';

export function useOpsBookingsState(params: OpsBookingsClientStateParams) {
  const { memberships, activeRestaurantId, accountSnapshot, setActiveRestaurantId } =
    useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const restaurantDetails = useOpsRestaurantDetails(activeRestaurantId ?? null);
  const isOnline = useOnlineStatus();

  const restaurantTimezone = restaurantDetails.data?.timezone ?? null;
  const restaurantSlug = restaurantDetails.data?.slug ?? activeMembership?.restaurantSlug ?? null;

  useEffect(() => {
    if (params.initialRestaurantId && params.initialRestaurantId !== activeRestaurantId) {
      setActiveRestaurantId(params.initialRestaurantId);
    }
  }, [activeRestaurantId, params.initialRestaurantId, setActiveRestaurantId]);

  const queryState = useOpsBookingsQueryState({
    ...params,
    activeRestaurantId,
    isOnline,
    restaurantTimezone,
    listableStatuses: OPS_LISTABLE_STATUSES,
  });

  const dataState = useOpsBookingsDataState({
    restaurantId: activeRestaurantId,
    restaurantSlug,
    restaurantTimezone,
    selectedDate: queryState.selectedDate,
    resolvedTime: queryState.resolvedTime,
    resolvedWindowMode: queryState.resolvedWindowMode,
    resolvedWindowMinutes:
      queryState.resolvedWindowMinutes ?? DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES,
    view: queryState.view,
    deferredSearch: queryState.deferredSearch,
    visibleSelectedStatuses: queryState.visibleSelectedStatuses,
    resolvedTableId: queryState.resolvedTableId,
    listableStatuses: OPS_LISTABLE_STATUSES,
  });

  const getBookingLabel = useCallback(
    (bookingId: string) => dataState.derivedData.bookingLabelsById.get(bookingId) || 'Walk-in Guest',
    [dataState.derivedData.bookingLabelsById],
  );

  const lifecycle = useOpsBookingsLifecycleHandlers({
    restaurantId: activeRestaurantId,
    targetDate: dataState.appliedDateRange?.date ?? null,
    isOnline,
    getBookingLabel,
  });

  const rows = useMemo(
    () =>
      buildOpsBookingsCardRows({
        bookings: dataState.derivedData.bookings,
        timezone: restaurantTimezone ?? 'UTC',
        now: new Date(),
        pendingActionsByBookingId: lifecycle.pendingActionsByBookingId,
      }),
    [
      dataState.derivedData.bookings,
      lifecycle.pendingActionsByBookingId,
      restaurantTimezone,
    ],
  );

  const resolveBookingById = useCallback(
    (bookingId: string | null): BookingDTO | null => {
      if (!bookingId) return null;
      return dataState.derivedData.bookingById.get(bookingId) ?? null;
    },
    [dataState.derivedData.bookingById],
  );

  const dialogs = useOpsBookingsDialogs({
    bookingById: dataState.derivedData.bookingById,
    focusBookingId: queryState.hydratedFocusBookingId,
    activeRestaurantId,
    restaurantTimezone,
    appliedDate: dataState.appliedDateRange?.date ?? null,
    fallbackRestaurantSlug: restaurantSlug,
    clearFocusParam: queryState.clearFocusParam,
  });

  const handleDetailsById = useCallback(
    (bookingId: string) => {
      const booking = resolveBookingById(bookingId);
      if (booking) {
        dialogs.onDetails(booking);
      }
    },
    [dialogs, resolveBookingById],
  );

  const handleEditById = useCallback(
    (bookingId: string) => {
      const booking = resolveBookingById(bookingId);
      if (booking) {
        dialogs.onEdit(booking);
      }
    },
    [dialogs, resolveBookingById],
  );

  const handleCancelById = useCallback(
    (bookingId: string) => {
      const booking = resolveBookingById(bookingId);
      if (booking) {
        dialogs.onCancelRequest(booking);
      }
    },
    [dialogs, resolveBookingById],
  );

  return {
    memberships,
    activeRestaurantId,
    activeMembership,
    accountSnapshot,
    restaurantTimezone,
    restaurantSlug,
    restaurantDetails,
    isOnline,
    queryState,
    dataState,
    lifecycle,
    rows,
    dialogs,
    handleDetailsById,
    handleEditById,
    handleCancelById,
    initialSnapshots: dataState.derivedData.initialSnapshots,
  } as const;
}
