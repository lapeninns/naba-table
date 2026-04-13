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
      sessionRecoveryAccessTokenTtlSeconds: 900,
    },
  },
}));

import { buildBookingManageUrl } from '@/server/bookings/manage-url';

describe('buildBookingManageUrl', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('creates a recover link for phone-only bookings', () => {
    const url = buildBookingManageUrl({
      id: 'booking-1',
      restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
      customer_email: '',
      customer_phone: '07467586751',
    });

    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/bookings/recover');
    expect(parsed.searchParams.get('access_token')).toBeTruthy();
    expect(parsed.searchParams.get('next')).toBe('/bookings/booking-1');
  });

  it('returns the recover error route when no contact method exists', () => {
    const url = buildBookingManageUrl({
      id: 'booking-1',
      restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
      customer_email: '',
      customer_phone: '',
    });

    expect(url).toBe('https://nabatable.com/bookings/recover/error?code=MISSING_ACCESS_TOKEN');
  });
});
