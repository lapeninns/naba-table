import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

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
  isError: boolean;
};

const DEFAULT_BOOKING_OPTION: BookingOption = 'drinks';

export function useTimeSlots({
  restaurantSlug,
  date,
  selectedTime,
}: UseTimeSlotsOptions): UseTimeSlotsResult {
  const normalizedSlug = restaurantSlug?.trim() ?? null;
  const scheduleQuery = useQuery<ReservationSchedule>({
    queryKey: scheduleQueryKey(normalizedSlug, date ?? null),
    enabled: Boolean(normalizedSlug && date),
    queryFn: ({ signal }) => {
      if (!normalizedSlug || !date) {
        throw new Error('Missing restaurant slug or date');
      }
      return fetchReservationSchedule(normalizedSlug, date, signal);
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    meta: { persist: false },
  });

  const slots = useMemo<TimeSlotDescriptor[]>(() => {
    if (!scheduleQuery.data) {
      return [];
    }
    return scheduleQuery.data.slots.map((slot) => toTimeSlotDescriptor(slot));
  }, [scheduleQuery.data]);

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
    scheduleQuery.data?.availableBookingOptions[0] ??
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
    schedule: scheduleQuery.data ?? null,
    availableBookingOptions: scheduleQuery.data?.availableBookingOptions ?? [],
    occasionCatalog: scheduleQuery.data?.occasionCatalog ?? [],
    isLoading: scheduleQuery.isLoading,
    isError: scheduleQuery.isError,
  };
}
