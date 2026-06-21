import { DateTime } from 'luxon';

export type BookingInstantFields = {
  start_at: string;
  end_at: string;
};

function toRequiredUtcIso(dateTime: DateTime, label: string): string {
  const iso = dateTime.toUTC().toISO();
  if (!dateTime.isValid || !iso) {
    throw new Error(`Unable to resolve booking ${label} instant`);
  }
  return iso;
}

export function buildBookingInstantFields(params: {
  startDateTime: DateTime;
  endDateTime: DateTime;
}): BookingInstantFields {
  return {
    start_at: toRequiredUtcIso(params.startDateTime, 'start'),
    end_at: toRequiredUtcIso(params.endDateTime, 'end'),
  };
}

export function buildBookingInstantFieldsFromLocalTimes(params: {
  bookingDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
}): BookingInstantFields {
  const startDateTime = DateTime.fromISO(`${params.bookingDate}T${params.startTime}`, {
    zone: params.timezone,
  });
  const endDateTime = DateTime.fromISO(`${params.bookingDate}T${params.endTime}`, {
    zone: params.timezone,
  });
  const resolvedEndDateTime =
    startDateTime.isValid && endDateTime.isValid && endDateTime <= startDateTime
      ? endDateTime.plus({ days: 1 })
      : endDateTime;

  return buildBookingInstantFields({
    startDateTime,
    endDateTime: resolvedEndDateTime,
  });
}
