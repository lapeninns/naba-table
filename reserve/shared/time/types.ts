export type Brand<T, Marker extends string> = T & { readonly __brand: Marker };

export type ReservationDate = Brand<string, 'ReservationDate'>;
export type ReservationTime = Brand<string, 'ReservationTime'>;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isReservationDate(value: string | null | undefined): value is ReservationDate {
  if (!value) return false;
  return DATE_REGEX.test(value);
}

export function isReservationTime(value: string | null | undefined): value is ReservationTime {
  if (!value) return false;
  return TIME_REGEX.test(value.trim());
}

export function toReservationDate(value: string): ReservationDate {
  if (!isReservationDate(value)) {
    throw new Error(`Invalid reservation date: ${value}`);
  }
  return value;
}

export function toReservationTime(value: string): ReservationTime {
  if (!isReservationTime(value)) {
    throw new Error(`Invalid reservation time: ${value}`);
  }
  return value.trim() as ReservationTime;
}
