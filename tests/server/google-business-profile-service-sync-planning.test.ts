import { describe, expect, it } from 'vitest';

import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';
import {
  assertGoogleServicePeriodsPushCapability,
  assertGoogleServicePeriodsPushPatch,
  createGoogleServicePeriodsPushUnavailableError,
  getProviderReferenceUpdatedAt,
  resolveRequestedDirection,
} from '@/server/google-business-profile/serviceSyncPlanning';

describe('google business profile service sync planning domain', () => {
  it('uses an explicit requested direction before timestamp planning', () => {
    expect(
      resolveRequestedDirection({
        requestedDirection: 'pull_from_gbp',
        coreUpdatedAt: '2026-05-01T12:00:00.000Z',
        providerUpdatedAt: '2026-05-01T10:00:00.000Z',
      }),
    ).toBe('pull_from_gbp');

    expect(
      resolveRequestedDirection({
        requestedDirection: 'push_to_gbp',
        coreUpdatedAt: null,
        providerUpdatedAt: '2026-05-01T10:00:00.000Z',
      }),
    ).toBe('push_to_gbp');
  });

  it('pushes when the core timestamp is newer than the provider reference', () => {
    expect(
      resolveRequestedDirection({
        coreUpdatedAt: '2026-05-01T12:00:00.000Z',
        providerUpdatedAt: '2026-05-01T10:00:00.000Z',
      }),
    ).toBe('push_to_gbp');
  });

  it('pulls when the provider timestamp is newer or tied', () => {
    expect(
      resolveRequestedDirection({
        coreUpdatedAt: '2026-05-01T10:00:00.000Z',
        providerUpdatedAt: '2026-05-01T12:00:00.000Z',
      }),
    ).toBe('pull_from_gbp');

    expect(
      resolveRequestedDirection({
        coreUpdatedAt: '2026-05-01T10:00:00.000Z',
        providerUpdatedAt: '2026-05-01T10:00:00.000Z',
      }),
    ).toBe('pull_from_gbp');
  });

  it('falls back to push only when the core timestamp is the only usable timestamp', () => {
    expect(
      resolveRequestedDirection({
        coreUpdatedAt: '2026-05-01T10:00:00.000Z',
        providerUpdatedAt: null,
      }),
    ).toBe('push_to_gbp');

    expect(
      resolveRequestedDirection({
        coreUpdatedAt: '2026-05-01T10:00:00.000Z',
        providerUpdatedAt: 'not-a-date',
      }),
    ).toBe('push_to_gbp');
  });

  it('falls back to pull when the core timestamp is missing or unusable', () => {
    expect(
      resolveRequestedDirection({
        coreUpdatedAt: null,
        providerUpdatedAt: '2026-05-01T10:00:00.000Z',
      }),
    ).toBe('pull_from_gbp');

    expect(
      resolveRequestedDirection({
        coreUpdatedAt: 'not-a-date',
        providerUpdatedAt: null,
      }),
    ).toBe('pull_from_gbp');
  });

  it('selects the latest provider reference timestamp from pull and push syncs', () => {
    expect(
      getProviderReferenceUpdatedAt({
        last_pull_at: '2026-04-18T11:00:00.000Z',
        last_push_at: '2026-04-18T12:00:00.000Z',
      }),
    ).toBe('2026-04-18T12:00:00.000Z');

    expect(
      getProviderReferenceUpdatedAt({
        last_pull_at: '2026-04-18T13:00:00.000Z',
        last_push_at: '2026-04-18T12:00:00.000Z',
      }),
    ).toBe('2026-04-18T13:00:00.000Z');
  });

  it('ignores invalid provider timestamps and returns null when none are usable', () => {
    expect(
      getProviderReferenceUpdatedAt({
        last_pull_at: 'not-a-date',
        last_push_at: '2026-04-18T12:00:00.000Z',
      }),
    ).toBe('2026-04-18T12:00:00.000Z');

    expect(
      getProviderReferenceUpdatedAt({
        last_pull_at: null,
        last_push_at: null,
      }),
    ).toBeNull();

    expect(getProviderReferenceUpdatedAt(null)).toBeNull();
  });

  it('creates a stable service-period push unavailable error', () => {
    expect(createGoogleServicePeriodsPushUnavailableError()).toMatchObject({
      code: 'GBP_SERVICE_PERIODS_PUSH_UNAVAILABLE',
      status: 409,
      message:
        'This Google Business Profile location does not expose a writable kitchen more-hours type yet, so service periods can only be pulled from GBP for now.',
    });
  });

  it('guards service-period push capability before building the patch', () => {
    expect(() => assertGoogleServicePeriodsPushCapability(true)).not.toThrow();
    expect(() => assertGoogleServicePeriodsPushCapability(false)).toThrow(
      GoogleBusinessProfileError,
    );

    try {
      assertGoogleServicePeriodsPushCapability(false);
      throw new Error('Expected service-period push capability guard to throw.');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'GBP_SERVICE_PERIODS_PUSH_UNAVAILABLE',
        status: 409,
      });
    }
  });

  it('requires a service-period push patch before orchestration calls Google', () => {
    const patch = {
      payload: { moreHours: [] },
      updateMask: ['moreHours'],
    };

    expect(assertGoogleServicePeriodsPushPatch(patch)).toBe(patch);
    expect(() => assertGoogleServicePeriodsPushPatch(null)).toThrow(GoogleBusinessProfileError);

    try {
      assertGoogleServicePeriodsPushPatch(null);
      throw new Error('Expected service-period push patch guard to throw.');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'GBP_SERVICE_PERIODS_PUSH_UNAVAILABLE',
        status: 409,
      });
    }
  });
});
