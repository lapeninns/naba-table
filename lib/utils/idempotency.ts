/**
 * Generates a unique idempotency key for one-time operations
 * Uses crypto.randomUUID() if available, otherwise falls back to timestamp + random string
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
