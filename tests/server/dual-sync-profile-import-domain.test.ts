import { describe, expect, it } from 'vitest';

import {
  buildProfileImportDetailsPartial,
  buildProfileImportSuccess,
  isProfileImportFieldKey,
  projectProfileImportValue,
  resolveProfileImportFieldConfig,
} from '@/server/dual-sync/publish/ports/profile-import-domain';
import { buildRegistry } from '@/server/dual-sync/registry';

import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';

function makeSnapshot(
  overrides: Partial<DualSyncCanonicalSnapshot> = {},
): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: 'Tasty',
      contactPhone: '+15551234567',
      address: '1 Main',
      storefrontAddress: null,
      googleMapUrl: 'https://maps.google.com/?cid=1',
      googleReviewUrl: 'https://search.google.com/local/writereview?placeid=abc',
    },
    operatingHours: { weekly: [] },
    servicePeriods: { periods: [] },
    businessContext: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
    },
    ...overrides,
  };
}

describe('profile import domain helpers', () => {
  it('identifies supported profile import fields', () => {
    expect(isProfileImportFieldKey('profile.businessDescription')).toBe(true);
    expect(isProfileImportFieldKey('profile.googleReviewUrl')).toBe(true);
    expect(isProfileImportFieldKey('profile.storefrontAddress')).toBe(false);
    expect(isProfileImportFieldKey('operatingHours.weekly.0')).toBe(false);
  });

  it('resolves importable registry configs and reports non-importable configs', () => {
    const registry = buildRegistry({
      coreSnapshot: makeSnapshot(),
      gbpSnapshot: makeSnapshot(),
      includeCoreOnly: false,
    });

    expect(resolveProfileImportFieldConfig(registry, 'profile.name').status).toBe('ready');
    expect(resolveProfileImportFieldConfig(registry, 'profile.storefrontAddress')).toMatchObject({
      status: 'failed',
      result: {
        status: 'failed',
        failure: { code: 'INVALID_DECISION' },
      },
    });
  });

  it('projects scalar Google profile values through the registry normalizer', () => {
    const registry = buildRegistry({
      coreSnapshot: makeSnapshot(),
      gbpSnapshot: makeSnapshot(),
      includeCoreOnly: false,
    });
    const configResult = resolveProfileImportFieldConfig(registry, 'profile.contactPhone');
    expect(configResult.status).toBe('ready');
    if (configResult.status === 'ready') {
      expect(
        projectProfileImportValue({
          fieldKey: 'profile.contactPhone',
          config: configResult.config,
          gbpSnapshot: makeSnapshot(),
        }),
      ).toMatchObject({
        status: 'ready',
        detailsKey: 'contactPhone',
        rawGbpValue: '+15551234567',
      });
    }
  });

  it('rejects missing profile data and non-scalar profile values', () => {
    const registry = buildRegistry({
      coreSnapshot: makeSnapshot(),
      gbpSnapshot: makeSnapshot(),
      includeCoreOnly: false,
    });
    const configResult = resolveProfileImportFieldConfig(registry, 'profile.address');
    expect(configResult.status).toBe('ready');
    if (configResult.status === 'ready') {
      expect(
        projectProfileImportValue({
          fieldKey: 'profile.address',
          config: configResult.config,
          gbpSnapshot: { ...makeSnapshot(), profile: null } as unknown as DualSyncCanonicalSnapshot,
        }),
      ).toMatchObject({
        status: 'failed',
        result: { failure: { code: 'PORT_FAILURE', retryable: true } },
      });
      expect(
        projectProfileImportValue({
          fieldKey: 'profile.address',
          config: configResult.config,
          gbpSnapshot: {
            ...makeSnapshot(),
            profile: { ...makeSnapshot().profile, address: { structured: true } },
          } as unknown as DualSyncCanonicalSnapshot,
        }),
      ).toMatchObject({
        status: 'failed',
        result: { failure: { code: 'PORT_FAILURE', retryable: false } },
      });
    }
  });

  it('builds timezone-preserving details partials', () => {
    expect(
      buildProfileImportDetailsPartial({
        timezone: 'Europe/London',
        detailsKey: 'businessDescription',
        normalizedGbpValue: 'New description',
      }),
    ).toEqual({
      timezone: 'Europe/London',
      businessDescription: 'New description',
    });
  });

  it('builds canonical success hashes from normalized Core and raw Google values', () => {
    const registry = buildRegistry({
      coreSnapshot: makeSnapshot(),
      gbpSnapshot: makeSnapshot(),
      includeCoreOnly: false,
    });
    const configResult = resolveProfileImportFieldConfig(registry, 'profile.businessDescription');
    expect(configResult.status).toBe('ready');
    if (configResult.status === 'ready') {
      const result = buildProfileImportSuccess({
        config: configResult.config,
        normalizedGbpValue: 'Tasty',
        rawGbpValue: 'Tasty',
      });
      expect(result.status).toBe('succeeded');
      if (result.status === 'succeeded') {
        expect(result.afterCoreHash).toBe(result.afterGbpHash);
        expect(result.afterCoreHash).toEqual(expect.any(String));
      }
    }
  });
});
