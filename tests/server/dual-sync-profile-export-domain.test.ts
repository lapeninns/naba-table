import { describe, expect, it } from 'vitest';

import {
  applyProfileBatchFailure,
  buildProfileExportSuccess,
  buildProfileExportUnsupportedFailure,
  parseProfileExportField,
  planProfileExportBatch,
  resolveProfileExportFieldConfig,
} from '@/server/dual-sync/publish/ports/profile-export-domain';
import { buildRegistry } from '@/server/dual-sync/registry';

import type { DualSyncPublishDecision } from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';

function makeSnapshot(
  overrides: Partial<DualSyncCanonicalSnapshot> = {},
): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: 'Fresh food.',
      contactPhone: '+441234567890',
      address: '1 High Street',
      storefrontAddress: null,
      googleMapUrl: null,
      googleReviewUrl: null,
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

function makeDecision(fieldKey: string): DualSyncPublishDecision {
  return {
    fieldKey,
    sectionKey: 'profile',
    action: 'export_to_google',
    pinnedCoreHash: null,
    pinnedGbpHash: null,
  };
}

describe('profile export domain helpers', () => {
  it('parses only populated profile field tails', () => {
    expect(parseProfileExportField('profile.name')).toBe('name');
    expect(parseProfileExportField('businessContext.categories.pub')).toBeNull();
    expect(parseProfileExportField('profile.')).toBeNull();
  });

  it('plans profile export batches by side-effect family', () => {
    const plan = planProfileExportBatch([
      makeDecision('profile.name'),
      makeDecision('profile.contactPhone'),
      makeDecision('profile.address'),
      makeDecision('profile.businessDescription'),
      makeDecision('profile.googleMapUrl'),
    ]);

    expect(plan.supported).toBe(true);
    if (plan.supported) {
      expect(plan.simplePush).toEqual([
        { fieldKey: 'profile.name', field: 'name' },
        { fieldKey: 'profile.contactPhone', field: 'contactPhone' },
      ]);
      expect(plan.locationPatch).toEqual([
        { fieldKey: 'profile.address', field: 'address' },
        { fieldKey: 'profile.businessDescription', field: 'businessDescription' },
      ]);
      expect(plan.unsupportedKeys).toEqual(['profile.googleMapUrl']);
      expect(plan.handledKeys).toEqual([
        'profile.name',
        'profile.contactPhone',
        'profile.address',
        'profile.businessDescription',
      ]);
    }
  });

  it('marks unknown profile fields as unsupported for batch coalescing', () => {
    expect(planProfileExportBatch([makeDecision('profile.unknown')])).toEqual({
      supported: false,
    });
    expect(planProfileExportBatch([makeDecision('servicePeriods.foo')])).toEqual({
      supported: false,
    });
  });

  it('builds unsupported and retryable batch failure results', () => {
    expect(buildProfileExportUnsupportedFailure('profile.googleReviewUrl')).toEqual({
      status: 'failed',
      failure: {
        code: 'UNSUPPORTED_FIELD',
        message: 'profile.googleReviewUrl is not exportable to Google.',
        retryable: false,
      },
    });

    expect(
      applyProfileBatchFailure({}, ['profile.name'], 'Profile batch push failed: boom'),
    ).toEqual({
      'profile.name': {
        status: 'failed',
        failure: {
          code: 'PORT_FAILURE',
          message: 'Profile batch push failed: boom',
          retryable: true,
        },
      },
    });
  });

  it('resolves registry configs and builds canonical success hashes', () => {
    const coreSnapshot = makeSnapshot();
    const registry = buildRegistry({
      coreSnapshot,
      gbpSnapshot: makeSnapshot(),
      includeCoreOnly: false,
    });

    const configResult = resolveProfileExportFieldConfig(registry, 'profile.name');
    expect(configResult.status).toBe('ready');
    if (configResult.status === 'ready') {
      const result = buildProfileExportSuccess(configResult.config, coreSnapshot.profile);
      expect(result.status).toBe('succeeded');
      if (result.status === 'succeeded') {
        expect(result.afterCoreHash).toBe(result.afterGbpHash);
      }
    }
  });
});
