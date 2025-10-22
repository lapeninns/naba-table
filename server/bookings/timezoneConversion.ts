import { DateTime } from "luxon";

export type VenueDateTime = {
  dateTime: DateTime;
  date: string;
  time: string;
};

export function convertIsoToVenueDateTime(iso: string, timezone: string): VenueDateTime {
  const parsed = DateTime.fromISO(iso, { setZone: true });

  if (!parsed.isValid) {
    throw new Error("Invalid ISO datetime value.");
  }

  const zoned = parsed.setZone(timezone);
  if (!zoned.isValid) {
    throw new Error(`Unable to resolve timezone "${timezone}".`);
  }

  const date = zoned.toISODate();
  if (!date) {
    throw new Error("Unable to derive booking date from provided time.");
  }

  return {
    dateTime: zoned,
    date,
    time: zoned.toFormat("HH:mm"),
  };
}

export function convertOptionalIsoToVenueDateTime(
  iso: string | null | undefined,
  timezone: string,
): VenueDateTime | null {
  if (!iso) {
    return null;
  }

  return convertIsoToVenueDateTime(iso, timezone);
}
