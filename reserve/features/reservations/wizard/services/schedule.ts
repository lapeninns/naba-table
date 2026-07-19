import { apiClient } from '@shared/api/client';

import type { RawScheduleSlot, ReservationSchedule, ServiceAvailability } from './timeSlots';
import type { BookingOption } from '@reserve/shared/booking';
import type { OccasionDefinition, OccasionKey } from '@reserve/shared/occasions';

export const scheduleQueryKey = (
  restaurantSlug: string | null | undefined,
  date: string | null | undefined,
  partySize: number | null = null,
) => ['reservations', 'schedule', restaurantSlug ?? '', date ?? '', partySize ?? 'raw'] as const;

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

const toNonNegativeNumberOr = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
};

const toOptionalPositiveNumber = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
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

const normalizeScheduleSlot = (
  value: unknown,
  defaultDurationMinutes: number,
): RawScheduleSlot | null => {
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
    durationMinutes: toPositiveNumberOr(value.durationMinutes, defaultDurationMinutes),
    availability: normalizeServiceAvailability(value.availability),
    disabled: value.disabled === true,
  };
};

export function normalizeReservationSchedulePayload(payload: unknown): ReservationSchedule {
  const record = isRecord(payload) ? payload : null;
  const defaultDurationMinutes = toPositiveNumberOr(record?.defaultDurationMinutes, 90);
  const rawSlots = Array.isArray(record?.slots) ? record.slots : [];
  const slots = rawSlots
    .map((slot) => normalizeScheduleSlot(slot, defaultDurationMinutes))
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
  const evaluatedPartySize = toOptionalPositiveNumber(record?.evaluatedPartySize);

  return {
    restaurantId: toStringOr(record?.restaurantId, ''),
    sundayRoastEnabled: record?.sundayRoastEnabled === true,
    ...(evaluatedPartySize === null ? {} : { evaluatedPartySize }),
    date: toStringOr(record?.date, ''),
    timezone: toStringOr(record?.timezone, 'UTC'),
    notes: toNullableString(record?.notes)?.trim() || null,
    intervalMinutes: toPositiveNumberOr(record?.intervalMinutes, 30),
    defaultDurationMinutes,
    lastSeatingBufferMinutes: toNonNegativeNumberOr(
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
  options?: {
    readonly partySize?: number;
    readonly signal?: AbortSignal;
  },
): Promise<ReservationSchedule> {
  const params = new URLSearchParams();
  if (date) {
    params.set('date', date);
  }
  if (options?.partySize !== undefined) {
    params.set('party', String(options.partySize));
  }

  const encodedSlug = encodeURIComponent(restaurantSlug);
  const path =
    params.size > 0
      ? `/restaurants/${encodedSlug}/schedule?${params.toString()}`
      : `/restaurants/${encodedSlug}/schedule`;

  const response = await apiClient.get<unknown>(path, { signal: options?.signal });
  return normalizeReservationSchedulePayload(response);
}

export type CalendarMask = {
  timezone: string;
  from: string;
  to: string;
  closedDaysOfWeek: number[];
  closedDates: string[];
  overrideDates?: string[];
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
