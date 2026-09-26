import { describe, expect, it } from 'vitest';

import {
  buildDeterministicIdempotencyKey,
  coerceUuid,
  normalizeIdempotencyKey,
} from '@/server/bookings/idempotency';

describe('booking idempotency helpers', () => {
  it('normalizes header idempotency keys', () => {
    expect(normalizeIdempotencyKey(null)).toBeNull();
    expect(normalizeIdempotencyKey('')).toBeNull();
    expect(normalizeIdempotencyKey('   ')).toBeNull();
    expect(normalizeIdempotencyKey('  request-key  ')).toBe('request-key');
  });

  it('coerces only UUID-shaped values', () => {
    const uuid = '9f0f8e22-08e4-4dd1-a766-a8db88794224';

    expect(coerceUuid(uuid)).toBe(uuid);
    expect(coerceUuid(uuid.toUpperCase())).toBe(uuid.toUpperCase());
    expect(coerceUuid('request-key')).toBeNull();
    expect(coerceUuid(null)).toBeNull();
  });

  it('builds the stable deterministic fallback key', () => {
    const key = buildDeterministicIdempotencyKey({
      restaurantId: 'restaurant-1',
      customerId: 'customer-1',
      bookingDate: '2026-05-22',
      startTime: '18:30',
      endTime: '20:00',
      partySize: 4,
    });

    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(
      buildDeterministicIdempotencyKey({
        restaurantId: 'restaurant-1',
        customerId: 'customer-1',
        bookingDate: '2026-05-22',
        startTime: '18:30',
        endTime: '20:00',
        partySize: 4,
      }),
    ).toBe(key);
  });

  it('derives a different key for a different party size (the RPC compares party size)', () => {
    const base = {
      restaurantId: 'restaurant-1',
      customerId: 'customer-1',
      bookingDate: '2026-05-22',
      startTime: '18:30',
      endTime: '20:00',
    };

    expect(buildDeterministicIdempotencyKey({ ...base, partySize: 2 })).not.toBe(
      buildDeterministicIdempotencyKey({ ...base, partySize: 3 }),
    );
  });
});
