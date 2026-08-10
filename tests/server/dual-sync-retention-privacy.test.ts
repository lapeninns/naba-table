import { describe, expect, it } from 'vitest';

import {
  GBP_NO_STORE_HEADERS,
  gbpNoStoreJson,
  isGbpQueryPersistenceAllowed,
  safeGbpTelemetry,
} from '@/server/dual-sync/retention/privacy';

describe('GBP cache and telemetry privacy', () => {
  it('defines private no-store headers for GBP responses', () => {
    expect(GBP_NO_STORE_HEADERS).toEqual({
      'Cache-Control': 'private, no-store, max-age=0',
      'CDN-Cache-Control': 'no-store',
      Vary: 'Cookie, Authorization',
    });
    const response = gbpNoStoreJson({ status: 'safe' });
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(response.headers.get('cdn-cache-control')).toBe('no-store');
  });

  it('denies browser persistence for GBP and dual-sync query keys', () => {
    expect(isGbpQueryPersistenceAllowed(['restaurant', 'r1', 'dual-sync', 'state'])).toBe(false);
    expect(isGbpQueryPersistenceAllowed(['google-business-profile', 'r1'])).toBe(false);
    expect(isGbpQueryPersistenceAllowed(['restaurant', 'r1', 'dualSyncJobs'])).toBe(false);
    expect(isGbpQueryPersistenceAllowed([{ route: '/api/ops/r1/gbp/candidates' }])).toBe(false);
    expect(isGbpQueryPersistenceAllowed([{ feature: 'googleBusinessProfileMetrics' }])).toBe(false);
    expect(isGbpQueryPersistenceAllowed(['bookings', 'r1'])).toBe(true);
  });

  it('retains only safe telemetry identifiers and codes', () => {
    expect(
      safeGbpTelemetry({
        eventId: 'evt-1',
        status: 'failed',
        errorCode: 'STALE_EPOCH',
        body: { title: 'provider content' },
        restaurantName: 'private name',
      }),
    ).toEqual({ eventId: 'evt-1', status: 'failed', errorCode: 'STALE_EPOCH' });
    expect(
      safeGbpTelemetry({
        eventId: 'provider business description',
        status: 'failed with guest@example.com',
        errorCode: 'STALE_EPOCH',
      }),
    ).toEqual({ errorCode: 'STALE_EPOCH' });
  });
});
