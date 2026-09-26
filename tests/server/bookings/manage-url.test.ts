import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    app: {
      url: 'https://nabatable.com',
    },
    raw: {
      NEXT_PUBLIC_SITE_URL: 'https://nabatable.com',
      SITE_URL: 'https://nabatable.com',
    },
    security: {
      sessionRecoveryAccessTokenSecret: 'test-secret',
    },
  },
}));

import {
  buildBookingManageLink,
  buildBookingManageUrl,
  buildBookingPlainUrl,
} from '@/server/bookings/manage-url';
import { validateBookingAccessToken } from '@/server/security/booking-access-token';

const BOOKING_ID = '65c3207e-318a-4e4b-b82d-1249a720d776';
const RESTAURANT_ID = '550e8400-e29b-41d4-a716-446655440000';

const originalEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
}

describe('buildBookingManageUrl', () => {
  beforeEach(() => {
    vi.useRealTimers();
    restoreEnv();
    process.env.NEXT_PUBLIC_SITE_URL = 'https://nabatable.com';
  });

  it('creates a booking-scoped recover link for phone-only bookings', () => {
    const url = buildBookingManageUrl({
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      customer_email: '',
      customer_phone: '07467586751',
    });

    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/bookings/recover');
    expect(parsed.searchParams.get('next')).toBeNull();
    const token = parsed.searchParams.get('access_token') ?? '';
    expect(token.startsWith('bk1.')).toBe(true);
    const validated = validateBookingAccessToken(token, { secret: 'test-secret' });
    expect(validated.ok && validated.payload).toMatchObject({
      bid: BOOKING_ID,
      rid: RESTAURANT_ID,
      src: 'link',
    });
  });

  it('returns the recover error route when no contact method exists', () => {
    const url = buildBookingManageUrl({
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      customer_email: '',
      customer_phone: '',
    });

    expect(url).toBe('https://nabatable.com/bookings/recover/error?code=MISSING_ACCESS_TOKEN');
  });

  it('sends preview bookings to the find page without throwing', () => {
    expect(
      buildBookingManageUrl({
        id: 'preview-confirmed',
        restaurant_id: RESTAURANT_ID,
        customer_email: 'guest@example.com',
        customer_phone: '',
      }),
    ).toBe('https://nabatable.com/bookings/find');
  });

  it('does not emit app-host recovery links when only the app URL is configured', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.SITE_URL;
    delete process.env.BASE_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.nabatable.com';

    const url = buildBookingManageUrl({
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      customer_email: 'guest@example.com',
      customer_phone: '',
    });

    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://nabatable.com');
    expect(parsed.pathname).toBe('/bookings/recover');
  });
});

describe('buildBookingManageLink', () => {
  beforeEach(() => {
    restoreEnv();
    process.env.NEXT_PUBLIC_SITE_URL = 'https://nabatable.com';
  });

  it('returns the link expiry with the url', () => {
    const now = new Date('2026-09-26T12:00:00.000Z');
    const link = buildBookingManageLink(
      {
        id: BOOKING_ID,
        restaurant_id: RESTAURANT_ID,
        customer_email: 'guest@example.com',
        customer_phone: null,
        end_at: '2026-09-27T20:00:00.000Z',
      },
      { now },
    );
    expect(link?.expiresAt.toISOString()).toBe('2026-09-28T20:00:00.000Z');
    expect(link?.url).toContain('/bookings/recover?access_token=bk1.');
  });

  it('is null for bookings that cannot hold a capability', () => {
    expect(
      buildBookingManageLink({
        id: 'preview-confirmed',
        restaurant_id: RESTAURANT_ID,
        customer_email: 'guest@example.com',
        customer_phone: null,
      }),
    ).toBeNull();
  });
});

describe('buildBookingPlainUrl', () => {
  it('links to the booking page without a token', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://nabatable.com';
    const url = buildBookingPlainUrl({ id: BOOKING_ID });
    expect(url).toBe(`https://nabatable.com/bookings/${BOOKING_ID}`);
    expect(url).not.toContain('access_token');
  });
});
