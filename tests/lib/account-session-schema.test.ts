import { describe, expect, it } from 'vitest';

import { accountSessionsResponseSchema } from '@/lib/account/session-schema';

describe('account sessions response schema', () => {
  it('accepts PostgreSQL timestamps with UTC offsets', () => {
    const timestamp = '2026-07-20T16:00:00+00:00';

    const result = accountSessionsResponseSchema.safeParse({
      sessions: [
        {
          id: '99999999-9999-4999-8999-000000000001',
          signedInAt: timestamp,
          lastActiveAt: timestamp,
          signedOutAt: null,
          refreshedAt: timestamp,
          expiresAt: timestamp,
          ipAddress: '203.0.113.4',
          assuranceLevel: 'aal2',
          approximateLocation: {
            city: 'London',
            region: 'ENG',
            countryCode: 'GB',
          },
          isActive: true,
          isCurrent: true,
          device: {
            id: '88888888-8888-4888-8888-000000000001',
            name: 'Reception computer',
            firstSeenAt: timestamp,
            sessionCount: 1,
            timeZone: 'Europe/London',
            locale: 'en-GB',
            kind: 'desktop',
            browser: 'Chrome',
            operatingSystem: 'macOS',
            label: 'Chrome on macOS',
          },
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
