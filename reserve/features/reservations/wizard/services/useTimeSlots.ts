import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { MAX_ONLINE_PARTY_SIZE, MIN_ONLINE_PARTY_SIZE } from '@/lib/bookings/partySize';
import { normalizeTime } from '@reserve/shared/time';

import { fetchReservationSchedule, scheduleQueryKey } from './schedule';
import {
  EMPTY_AVAILABILITY,
  toTimeSlotDescriptor,
  type ReservationSchedule,
  type ServiceAvailability,
  type TimeSlotDescriptor,
} from './timeSlots';

import type { BookingOption } from '@reserve/shared/booking';
import type { OccasionDefinition } from '@reserve/shared/occasions';

export type UseTimeSlotsOptions = {
  restaurantSlug: string | null | undefined;
  date: string | null | undefined;
  partySize?: number;
  selectedTime: string | null | undefined;
};

export type UseTimeSlotsResult = {
  slots: TimeSlotDescriptor[];
  serviceAvailability: ServiceAvailability;
  inferBookingOption: (time: string | null | undefined) => BookingOption;
  schedule: ReservationSchedule | null;
  availableBookingOptions: BookingOption[];
  occasionCatalog: OccasionDefinition[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
};

const DEFAULT_BOOKING_OPTION: BookingOption = 'lunch';

export function useTimeSlots({
  restaurantSlug,
  date,
  partySize = 1,
  selectedTime,
}: UseTimeSlotsOptions): UseTimeSlotsResult {
  const normalizedSlug = restaurantSlug?.trim() ?? null;
  const normalizedPartySize = Math.min(
    MAX_ONLINE_PARTY_SIZE,
    Math.max(MIN_ONLINE_PARTY_SIZE, Math.round(partySize)),
  );
  const scheduleQuery = useQuery<ReservationSchedule>({
    queryKey: scheduleQueryKey(normalizedSlug, date ?? null, normalizedPartySize),
    enabled: Boolean(normalizedSlug && date),
    queryFn: ({ signal }) => {
      if (!normalizedSlug || !date) {
        throw new Error('Missing restaurant slug or date');
      }
      return fetchReservationSchedule(normalizedSlug, date, {
        partySize: normalizedPartySize,
        signal,
      });
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    meta: { persist: false },
  });
  const scheduleData = scheduleQuery.data;
  const activeSchedule: ReservationSchedule | null =
    scheduleData !== undefined &&
    scheduleData.date === date &&
    scheduleData.evaluatedPartySize === normalizedPartySize
      ? scheduleData
      : null;

  const slots = useMemo<TimeSlotDescriptor[]>(() => {
    if (!activeSchedule) {
      return [];
    }
    return activeSchedule.slots.map((slot) => toTimeSlotDescriptor(slot));
  }, [activeSchedule]);

  const normalizedSelectedTime = useMemo(() => normalizeTime(selectedTime), [selectedTime]);

  const activeSlot = useMemo(() => {
    if (slots.length === 0) {
      return undefined;
    }
    if (normalizedSelectedTime) {
      const exact = slots.find((slot) => slot.value === normalizedSelectedTime);
      if (exact) {
        return exact;
      }
    }
    return slots[0];
  }, [slots, normalizedSelectedTime]);

  const serviceAvailability = activeSlot?.availability ?? EMPTY_AVAILABILITY;
  const fallbackBookingOption =
    activeSchedule?.availableBookingOptions[0] ??
    activeSlot?.defaultBookingOption ??
    DEFAULT_BOOKING_OPTION;

  const inferBookingOption = useCallback(
    (time: string | null | undefined): BookingOption => {
      const normalized = normalizeTime(time);
      if (!normalized) {
        return activeSlot?.defaultBookingOption ?? fallbackBookingOption;
      }
      const slot = slots.find((entry) => entry.value === normalized);
      if (slot) {
        return slot.defaultBookingOption ?? slot.bookingOption;
      }
      return activeSlot?.defaultBookingOption ?? fallbackBookingOption;
    },
    [activeSlot, slots, fallbackBookingOption],
  );

  return {
    slots,
    serviceAvailability,
    inferBookingOption,
    schedule: activeSchedule,
    availableBookingOptions: activeSchedule?.availableBookingOptions ?? [],
    occasionCatalog: activeSchedule?.occasionCatalog ?? [],
    isLoading: scheduleQuery.isLoading || (!activeSchedule && scheduleQuery.isFetching),
    isFetching: scheduleQuery.isFetching,
    isError: scheduleQuery.isError,
  };
}
