import { describe, expect, it } from 'vitest';

import { validateFeatureFlagRegistry } from '@/scripts/governance/feature-flag-contract';

describe('feature-flag lifecycle contract', () => {
  it('accepts a registered, referenced, unexpired flag', () => {
    expect(
      validateFeatureFlagRegistry({
        flags: [
          {
            key: 'new-booking-flow',
            owner: 'booking-platform',
            expiresAt: '2026-08-15',
            removalIssue: 'https://github.com/lapeninns/nabatable/issues/123',
          },
        ],
        now: new Date('2026-07-15T12:00:00.000Z'),
        referencedKeys: new Set(['new-booking-flow']),
      }),
    ).toEqual([]);
  });

  it('reports expired, dead, duplicate, and unregistered flags', () => {
    const issues = validateFeatureFlagRegistry({
      flags: [
        {
          key: 'expired-flag',
          owner: 'ops',
          expiresAt: '2026-01-01',
          removalIssue: 'https://github.com/lapeninns/nabatable/issues/1',
        },
        {
          key: 'dead-flag',
          owner: 'ops',
          expiresAt: '2026-12-01',
          removalIssue: 'https://github.com/lapeninns/nabatable/issues/2',
        },
        {
          key: 'dead-flag',
          owner: 'ops',
          expiresAt: '2026-12-01',
          removalIssue: 'https://github.com/lapeninns/nabatable/issues/2',
        },
      ],
      now: new Date('2026-07-15T12:00:00.000Z'),
      referencedKeys: new Set(['expired-flag', 'unregistered-flag']),
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('expired-flag'),
        expect.stringContaining('dead-flag'),
        expect.stringContaining('duplicate'),
        expect.stringContaining('unregistered-flag'),
      ]),
    );
  });
});
