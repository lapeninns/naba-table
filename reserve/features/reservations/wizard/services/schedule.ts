import { apiClient } from '@shared/api/client';

import type { RawScheduleSlot, ReservationSchedule, ServiceAvailability } from './timeSlots';
import type { BookingOption } from '@reserve/shared/booking';
import type { OccasionDefinition, OccasionKey } from '@reserve/shared/occasions';

export const scheduleQueryKey = (
  restaurantSlug: string | null | undefined,
  date: string | null | undefined,
) => ['reservations', 'schedule', restaurantSlug ?? '', date ?? ''] as const;

const DEFAULT_BOOKING_OPTION: BookingOption = 'lunch';
const DEFAULT_SERVICE_AVAILABILITY: ServiceAvailability = {
  services: {},
  labels: {
    kitchenClosed: false,
    lunchWindow: false,
    dinnerWindow: false,
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const toStringOr = (value: unknown, fallback: string): string => {
  return typeof value === 'string' ? value : fallback;
};

const toNullableString = (value: unknown): string | null => {
  return typeof value === 'string' ? value : null;
};

const toPositiveNumberOr = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
};

const normalizeBookingOption = (value: unknown): BookingOption => {
  return value === 'dinner' ? 'dinner' : DEFAULT_BOOKING_OPTION;
};

const normalizeServiceAvailability = (value: unknown): ServiceAvailability => {
  if (!isRecord(value)) {
    return DEFAULT_SERVICE_AVAILABILITY;
  }

  const labelsRecord = isRecord(value.labels) ? value.labels : null;
  const servicesRecord = isRecord(value.services) ? value.services : null;
  const services = Object.fromEntries(
    Object.entries(servicesRecord ?? {}).filter(
      ([, state]) => state === 'enabled' || state === 'disabled',
    ),
  ) as Record<OccasionKey, 'enabled' | 'disabled'>;

  return {
    services,
    labels: {
      kitchenClosed: labelsRecord?.kitchenClosed === true,
      lunchWindow: labelsRecord?.lunchWindow === true,
      dinnerWindow: labelsRecord?.dinnerWindow === true,
    },
  };
};

const normalizeScheduleSlot = (value: unknown): RawScheduleSlot | null => {
  if (!isRecord(value)) {
    return null;
  }

  const slotValue = toNullableString(value.value);
  if (!slotValue) {
    return null;
  }

  const bookingOption = normalizeBookingOption(value.bookingOption);
  const defaultBookingOption = normalizeBookingOption(
    value.defaultBookingOption ?? value.bookingOption,
  );

  return {
    value: slotValue,
    display: toStringOr(value.display, slotValue),
    periodId: toNullableString(value.periodId),
    periodName: toNullableString(value.periodName),
    bookingOption,
    defaultBookingOption,
    availability: normalizeServiceAvailability(value.availability),
    disabled: value.disabled === true,
  };
};

export function normalizeReservationSchedulePayload(payload: unknown): ReservationSchedule {
  const record = isRecord(payload) ? payload : null;
  const defaultDurationMinutes = toPositiveNumberOr(record?.defaultDurationMinutes, 90);
  const rawSlots = Array.isArray(record?.slots) ? record.slots : [];
  const slots = rawSlots
    .map((slot) => normalizeScheduleSlot(slot))
    .filter((slot): slot is RawScheduleSlot => slot !== null);
  const availableBookingOptions = Array.from(
    new Set(
      (Array.isArray(record?.availableBookingOptions) ? record.availableBookingOptions : []).map(
        (value) => normalizeBookingOption(value),
      ),
    ),
  );
  const occasionCatalog = Array.isArray(record?.occasionCatalog)
    ? (record.occasionCatalog.filter((entry): entry is OccasionDefinition =>
        isRecord(entry),
      ) as OccasionDefinition[])
    : [];
  const windowRecord = isRecord(record?.window) ? record.window : null;

  return {
    restaurantId: toStringOr(record?.restaurantId, ''),
    date: toStringOr(record?.date, ''),
    timezone: toStringOr(record?.timezone, 'UTC'),
    intervalMinutes: toPositiveNumberOr(record?.intervalMinutes, 30),
    defaultDurationMinutes,
    lastSeatingBufferMinutes: toPositiveNumberOr(
      record?.lastSeatingBufferMinutes,
      defaultDurationMinutes,
    ),
    window: {
      opensAt: toNullableString(windowRecord?.opensAt),
      closesAt: toNullableString(windowRecord?.closesAt),
    },
    isClosed: record?.isClosed === true,
    availableBookingOptions,
    slots,
    occasionCatalog,
  };
}

export async function fetchReservationSchedule(
  restaurantSlug: string,
  date: string | null | undefined,
  signal?: AbortSignal,
): Promise<ReservationSchedule> {
  const params = new URLSearchParams();
  if (date) {
    params.set('date', date);
  }

  const encodedSlug = encodeURIComponent(restaurantSlug);
  const path =
    params.size > 0
      ? `/restaurants/${encodedSlug}/schedule?${params.toString()}`
      : `/restaurants/${encodedSlug}/schedule`;

  const response = await apiClient.get<unknown>(path, { signal });
  return normalizeReservationSchedulePayload(response);
}

export type CalendarMask = {
  timezone: string;
  from: string;
  to: string;
  closedDaysOfWeek: number[];
  closedDates: string[];
};

export const calendarMaskQueryKey = (
  restaurantSlug: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
) => ['reservations', 'calendar-mask', restaurantSlug ?? '', from ?? '', to ?? ''] as const;

export async function fetchCalendarMask(
  restaurantSlug: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<CalendarMask> {
  const params = new URLSearchParams();
  params.set('from', from);
  params.set('to', to);

  const encodedSlug = encodeURIComponent(restaurantSlug);
  const path = `/restaurants/${encodedSlug}/calendar-mask?${params.toString()}`;

  return apiClient.get<CalendarMask>(path, { signal });
}
