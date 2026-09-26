/**
 * Capacity RPC failures can carry raw database text in `details` (for example the
 * `sqlerrm`/`sqlstate` pair that update_booking_with_capacity_check returns on
 * INTERNAL_ERROR). That text can quote row values such as guest emails, so it must never
 * reach clients or observability events. This keeps only a whitelist of non-text fields:
 * capacity numbers, the service period label, IANA timezone names and the conflict flags.
 */

const NUMERIC_KEYS = [
  'maxCovers',
  'bookedCovers',
  'requestedCovers',
  'availableCovers',
  'maxParties',
  'bookedParties',
  'availableParties',
] as const;

const BOOLEAN_KEYS = ['bookingConflict', 'idempotencyConflict'] as const;

const TIMEZONE_KEYS = ['timezone', 'originalTimezone'] as const;

const TIMEZONE_PATTERN = /^[A-Za-z0-9_+\-/]{1,64}$/;
const SERVICE_PERIOD_PATTERN = /^[A-Za-z0-9 _-]{1,64}$/;

export type SafeCapacityErrorDetails = Record<string, number | string | boolean>;

export function safeCapacityErrorDetails(details: unknown): SafeCapacityErrorDetails | undefined {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return undefined;
  }
  const source = details as Record<string, unknown>;
  const safe: SafeCapacityErrorDetails = {};

  for (const key of NUMERIC_KEYS) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      safe[key] = value;
    }
  }
  for (const key of BOOLEAN_KEYS) {
    const value = source[key];
    if (typeof value === 'boolean') {
      safe[key] = value;
    }
  }
  for (const key of TIMEZONE_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && TIMEZONE_PATTERN.test(value)) {
      safe[key] = value;
    }
  }
  const servicePeriod = source.servicePeriod;
  if (typeof servicePeriod === 'string' && SERVICE_PERIOD_PATTERN.test(servicePeriod)) {
    safe.servicePeriod = servicePeriod;
  }

  return Object.keys(safe).length > 0 ? safe : undefined;
}
