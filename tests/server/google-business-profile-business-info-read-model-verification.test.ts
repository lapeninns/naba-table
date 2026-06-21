import { describe, expect, it } from 'vitest';

import { buildFieldSyncStatus } from '@/server/google-business-profile/businessInfoFieldSyncStatus';
import {
  buildFieldSyncStatusLookup,
  combineFieldVerifications,
  resolveFieldVerification,
} from '@/server/google-business-profile/businessInfoReadModelVerification';

describe('google business profile business info read model verification domain', () => {
  it('builds lookup keys from field sync status rows', () => {
    const row = buildFieldSyncStatus({
      restaurantId: 'rest-1',
      entityTable: 'restaurant_business_details',
      entityKey: 'details',
      fieldKey: 'business_name',
      providerRecordId: 'locations/123',
      value: 'Old Crown',
      syncedAt: '2026-05-22T07:00:00.000Z',
    });

    const lookup = buildFieldSyncStatusLookup([row] as never);

    expect(lookup.get('restaurant_business_details::details::business_name')).toBe(row);
  });

  it('marks verification as synced only when provider hash matches the current value', () => {
    const row = buildFieldSyncStatus({
      restaurantId: 'rest-1',
      entityTable: 'restaurant_business_details',
      entityKey: 'details',
      fieldKey: 'business_name',
      providerRecordId: 'locations/123',
      value: 'Old Crown',
      syncedAt: '2026-05-22T07:00:00.000Z',
    });

    expect(resolveFieldVerification(row as never, 'Old Crown')).toMatchObject({
      syncStatus: 'synced',
      isVerified: true,
    });
    expect(resolveFieldVerification(row as never, 'New Crown')).toMatchObject({
      syncStatus: 'drifted',
      isVerified: false,
    });
  });

  it('returns the first drifted verification when combining field-level statuses', () => {
    const synced = {
      provider: 'gbp',
      syncStatus: 'synced',
      isVerified: true,
      verifiedAt: null,
      verifiedBy: null,
      lastSyncedAt: null,
      lastCheckedAt: null,
    };
    const drifted = {
      provider: 'gbp',
      syncStatus: 'drifted',
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      lastSyncedAt: null,
      lastCheckedAt: null,
    };

    expect(combineFieldVerifications([synced, drifted])).toBe(drifted);
    expect(combineFieldVerifications([null, synced])).toBe(synced);
    expect(combineFieldVerifications([null])).toBeNull();
  });
});
