import { describe, expect, it } from 'vitest';

import {
  buildBookingConfirmationCookie,
  buildBookingSessionRecoveryAccessCookie,
} from '@/server/bookings/response-cookies';
import { validateSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';

const RESTAURANT_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('booking response cookie payloads', () => {
  it('builds the confirmation cookie payload with the existing options', () => {
    expect(buildBookingConfirmationCookie('confirmation-token-1')).toEqual({
      name: 'sr_confirm',
      value: 'confirmation-token-1',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/api/bookings/confirm',
        maxAge: 60 * 60,
      },
    });
  });

  it('does not build a confirmation cookie without a token', () => {
    expect(buildBookingConfirmationCookie(null)).toBeNull();
  });

  it('builds a session recovery cookie with the default ttl and signed contact payload', () => {
    const cookie = buildBookingSessionRecoveryAccessCookie({
      secret: 'test-secret',
      ttlSeconds: undefined,
      restaurantId: RESTAURANT_ID,
      email: 'Guest@Example.com',
      phone: '07467586751',
    });

    expect(cookie?.name).toBe('sr_access');
    expect(cookie?.options).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 900,
    });

    const validation = validateSessionRecoveryAccessToken(cookie?.value ?? '', {
      secret: 'test-secret',
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) {
      return;
    }

    expect(validation.payload.restaurantId).toBe(RESTAURANT_ID);
    expect(validation.payload.email).toBe('guest@example.com');
    expect(validation.payload.phone).toBe('447467586751');
    expect(cookie?.value).not.toContain('guest@example.com');
    expect(cookie?.value).not.toContain('447467586751');
    expect(validation.payload.exp - validation.payload.iat).toBe(900);
  });

  it('uses the configured session recovery ttl for cookie max age and token expiry', () => {
    const cookie = buildBookingSessionRecoveryAccessCookie({
      secret: 'test-secret',
      ttlSeconds: 1800,
      restaurantId: RESTAURANT_ID,
      email: null,
      phone: '07467586751',
    });

    expect(cookie?.options.maxAge).toBe(1800);

    const validation = validateSessionRecoveryAccessToken(cookie?.value ?? '', {
      secret: 'test-secret',
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) {
      return;
    }

    expect(validation.payload.exp - validation.payload.iat).toBe(1800);
  });

  it('does not build a session recovery cookie without a secret', () => {
    expect(
      buildBookingSessionRecoveryAccessCookie({
        secret: '',
        ttlSeconds: 900,
        restaurantId: RESTAURANT_ID,
        email: 'guest@example.com',
        phone: '07467586751',
      }),
    ).toBeNull();
  });
});
