import { useCallback, useMemo } from 'react';

import { buildTimeSlots, getServiceAvailability, resolveDefaultBookingOption } from './timeSlots';

import type { BookingOption, ServiceAvailability, TimeSlotDescriptor } from './timeSlots';
import type { ReservationConfig } from '@reserve/shared/config/reservations';
import type { ReservationTime } from '@reserve/shared/time';

export type UseTimeSlotsOptions = {
  date: string | null | undefined;
  selectedTime: string | ReservationTime | null | undefined;
  config?: ReservationConfig;
};

export type UseTimeSlotsResult = {
  slots: TimeSlotDescriptor[];
  serviceAvailability: ServiceAvailability;
  inferBookingOption: (time: string | ReservationTime | null | undefined) => BookingOption;
};

export function useTimeSlots({
  date,
  selectedTime,
  config,
}: UseTimeSlotsOptions): UseTimeSlotsResult {
  const slots = useMemo(() => buildTimeSlots({ date, config }), [date, config]);

  const serviceAvailability = useMemo(
    () => getServiceAvailability(date, selectedTime, config),
    [date, selectedTime, config],
  );

  const inferBookingOption = useCallback(
    (time: string | ReservationTime | null | undefined) =>
      resolveDefaultBookingOption(date, time, config),
    [date, config],
  );

  return { slots, serviceAvailability, inferBookingOption };
}
