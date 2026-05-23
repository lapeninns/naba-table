import { describe, expect, it } from 'vitest';

import {
  compareProfileFieldValue,
  latestTimestamp,
  recommendedDirection,
} from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileVerificationComparators';

describe('googleBusinessProfileVerificationComparators', () => {
  it('compares text fields after whitespace and case normalization', () => {
    expect(compareProfileFieldValue('name', ' Old   Crown Girton ', 'old crown girton')).toBe(true);
    expect(compareProfileFieldValue('address', '1 High Street', '2 High Street')).toBe(false);
    expect(compareProfileFieldValue('businessDescription', '', 'Village pub')).toBe(false);
  });

  it('compares phone fields by formatted numeric content', () => {
    expect(compareProfileFieldValue('contactPhone', '+44 1223 277217', '+44 (1223) 277217')).toBe(
      true,
    );
    expect(compareProfileFieldValue('contactPhone', '+44 1223 277217', '0044 1223 277217')).toBe(
      false,
    );
    expect(compareProfileFieldValue('contactPhone', null, '+44 1223 277217')).toBe(false);
  });

  it('compares GBP URLs with normalized protocol, host, and trailing path slashes', () => {
    expect(
      compareProfileFieldValue(
        'googleMapUrl',
        'https://MAPS.google.com/place/',
        'https://maps.google.com/place',
      ),
    ).toBe(true);
    expect(
      compareProfileFieldValue(
        'googleReviewUrl',
        'https://search.google.com/local/writereview?placeid=one',
        'https://search.google.com/local/writereview?placeid=two',
      ),
    ).toBe(false);
  });

  it('selects the latest valid provider timestamp', () => {
    expect(latestTimestamp('2026-04-18T12:00:00.000Z', '2026-04-19T12:00:00.000Z')).toBe(
      '2026-04-19T12:00:00.000Z',
    );
    expect(latestTimestamp('not-a-date', '2026-04-19T12:00:00.000Z')).toBe(
      '2026-04-19T12:00:00.000Z',
    );
    expect(latestTimestamp(null, undefined)).toBeNull();
  });

  it('recommends sync direction from capability and timestamp state', () => {
    expect(
      recommendedDirection({
        coreUpdatedAt: '2026-04-20T12:00:00.000Z',
        providerUpdatedAt: '2026-04-19T12:00:00.000Z',
        canPull: true,
        canPush: true,
      }),
    ).toBe('push_to_gbp');
    expect(
      recommendedDirection({
        coreUpdatedAt: '2026-04-18T12:00:00.000Z',
        providerUpdatedAt: '2026-04-19T12:00:00.000Z',
        canPull: true,
        canPush: true,
      }),
    ).toBe('pull_from_gbp');
    expect(
      recommendedDirection({
        coreUpdatedAt: '2026-04-20T12:00:00.000Z',
        providerUpdatedAt: '2026-04-19T12:00:00.000Z',
        canPull: true,
        canPush: false,
      }),
    ).toBe('pull_from_gbp');
    expect(
      recommendedDirection({
        coreUpdatedAt: '2026-04-20T12:00:00.000Z',
        providerUpdatedAt: '2026-04-19T12:00:00.000Z',
        canPull: false,
        canPush: false,
      }),
    ).toBeNull();
  });
});
