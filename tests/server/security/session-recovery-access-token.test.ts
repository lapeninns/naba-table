import { describe, expect, it } from 'vitest';

import {
  createSessionRecoveryAccessToken,
  sessionRecoveryTokenMatchesBookingContact,
  validateSessionRecoveryAccessToken,
} from '@/server/security/session-recovery-access-token';

describe('session recovery access tokens', () => {
  it('creates and validates a phone-only token', () => {
    const token = createSessionRecoveryAccessToken({
      restaurantId: '550e8400-e29b-41d4-a716-446655440000',
      phone: '07467586751',
      secret: 'test-secret',
      now: new Date('2026-04-13T12:00:00.000Z'),
      ttlSeconds: 900,
    });

    const result = validateSessionRecoveryAccessToken(token, {
      secret: 'test-secret',
      now: new Date('2026-04-13T12:05:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.payload.email).toBeNull();
    expect(result.payload.phone).toBe('447467586751');
  });

  it('rejects token creation when neither email nor phone is provided', () => {
    expect(() =>
      createSessionRecoveryAccessToken({
        restaurantId: '550e8400-e29b-41d4-a716-446655440000',
        secret: 'test-secret',
      }),
    ).toThrow('At least one contact method is required');
  });

  it('creates an email recovery token when an optional phone value cannot be normalized', () => {
    const token = createSessionRecoveryAccessToken({
      restaurantId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'guest@example.com',
      phone: 'not-a-phone',
      secret: 'test-secret',
      now: new Date('2026-04-13T12:00:00.000Z'),
      ttlSeconds: 900,
    });

    const result = validateSessionRecoveryAccessToken(token, {
      secret: 'test-secret',
      now: new Date('2026-04-13T12:05:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.payload.email).toBe('guest@example.com');
    expect(result.payload.phone).toBeNull();
  });

  it('matches phone-only tokens against phone-only bookings', () => {
    const token = createSessionRecoveryAccessToken({
      restaurantId: '550e8400-e29b-41d4-a716-446655440000',
      phone: '+447467586751',
      secret: 'test-secret',
    });

    const validated = validateSessionRecoveryAccessToken(token, { secret: 'test-secret' });
    expect(validated.ok).toBe(true);
    if (!validated.ok) {
      return;
    }

    expect(
      sessionRecoveryTokenMatchesBookingContact({
        payload: validated.payload,
        booking: {
          restaurantId: '550e8400-e29b-41d4-a716-446655440000',
          email: '',
          phone: '07467586751',
        },
      }),
    ).toBe(true);

    expect(
      sessionRecoveryTokenMatchesBookingContact({
        payload: validated.payload,
        booking: {
          restaurantId: '550e8400-e29b-41d4-a716-446655440000',
          email: '',
          phone: '07111111111',
        },
      }),
    ).toBe(false);
  });

  it('still requires both contacts to match when the token contains both', () => {
    const token = createSessionRecoveryAccessToken({
      restaurantId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'guest@example.com',
      phone: '07467586751',
      secret: 'test-secret',
    });

    const validated = validateSessionRecoveryAccessToken(token, { secret: 'test-secret' });
    expect(validated.ok).toBe(true);
    if (!validated.ok) {
      return;
    }

    expect(
      sessionRecoveryTokenMatchesBookingContact({
        payload: validated.payload,
        booking: {
          restaurantId: '550e8400-e29b-41d4-a716-446655440000',
          email: 'guest@example.com',
          phone: '07467586751',
        },
      }),
    ).toBe(true);

    expect(
      sessionRecoveryTokenMatchesBookingContact({
        payload: validated.payload,
        booking: {
          restaurantId: '550e8400-e29b-41d4-a716-446655440000',
          email: 'other@example.com',
          phone: '07467586751',
        },
      }),
    ).toBe(false);
  });
});
