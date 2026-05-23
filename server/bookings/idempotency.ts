import { createHash } from 'crypto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeIdempotencyKey(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function coerceUuid(value: string | null): string | null {
  if (!value) return null;
  return UUID_REGEX.test(value) ? value : null;
}

export function buildDeterministicIdempotencyKey(params: {
  restaurantId: string;
  customerId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
}): string {
  const payload = `${params.restaurantId}|${params.customerId}|${params.bookingDate}|${params.startTime}|${params.endTime}`;
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}
