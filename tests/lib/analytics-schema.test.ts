import { describe, expect, it } from 'vitest';

import { sanitizeAnalyticsProps } from '@/lib/analytics/schema';

describe('analytics schema allowlist', () => {
  it('keeps allowlisted props and strips query strings from route-like values', () => {
    expect(
      sanitizeAnalyticsProps({
        type: 'error',
        path: '/bookings/recover?access_token=secret',
        redirectedFrom: '/guest/dashboard?token_hash=secret',
        referrer: 'https://evil.example/start?code=secret',
        arbitrary: 'drop-me',
        email: 'guest@example.com',
      }),
    ).toEqual({
      type: 'error',
      path: '/bookings/recover',
      redirectedFrom: '/guest/dashboard',
      referrer: 'https://evil.example/start',
    });
  });
});
