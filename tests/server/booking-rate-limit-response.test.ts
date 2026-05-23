import { describe, expect, it } from 'vitest';

import {
  buildBookingCreateRateLimitResponse,
  buildGuestLookupRateLimitResponse,
  calculateRetryAfterSeconds,
} from '@/server/bookings/rate-limit-response';

describe('booking rate-limit response builders', () => {
  it('rounds retry-after seconds up and keeps a minimum of one second', () => {
    expect(calculateRetryAfterSeconds(1_001, 1)).toBe(1);
    expect(calculateRetryAfterSeconds(1_002, 1)).toBe(2);
    expect(calculateRetryAfterSeconds(1, 10_000)).toBe(1);
  });

  it('builds the guest lookup rate-limit response with access diagnostics', () => {
    const access = {
      mode: 'contact_query',
      rateSource: 'memory',
      token: { provided: false },
    };

    expect(
      buildGuestLookupRateLimitResponse({
        rateLimit: { resetAt: 65_000 },
        access,
        now: 5_000,
      }),
    ).toEqual({
      body: {
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        retryAfter: 60,
        access,
      },
      init: {
        status: 429,
        headers: {
          'Retry-After': '60',
        },
      },
    });
  });

  it('builds the booking create rate-limit response with public quota headers', () => {
    expect(
      buildBookingCreateRateLimitResponse({
        rateLimit: {
          resetAt: 25_500,
          limit: 60,
          remaining: 0,
        },
        now: 20_000,
      }),
    ).toEqual({
      body: {
        error: 'Too many booking requests. Please try again in a moment.',
        code: 'RATE_LIMITED',
        retryAfter: 6,
      },
      init: {
        status: 429,
        headers: {
          'Retry-After': '6',
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '25500',
        },
      },
    });
  });
});
