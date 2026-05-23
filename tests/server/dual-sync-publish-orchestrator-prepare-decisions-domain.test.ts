import { describe, expect, it } from 'vitest';

import { hashCanonicalJson } from '@/server/dual-sync/hashing';
import { valueForField } from '@/server/dual-sync/publish/orchestrator-domain';
import { evaluatePublishDecision } from '@/server/dual-sync/publish/orchestrator-prepare-decisions-domain';
import { buildRegistry, findFieldConfig } from '@/server/dual-sync/registry';

import type { DualSyncRuntimeFlags } from '@/server/dual-sync/flag';
import type { DualSyncPublishDecision } from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';

const runtimeFlags: DualSyncRuntimeFlags = {
  importEnabled: true,
  exportEnabled: true,
  autoCandidatesEnabled: true,
  highRiskExportsEnabled: true,
  menuSyncEnabled: true,
  attributesSyncEnabled: true,
  scheduledRefreshEnabled: true,
};

function makeSnapshot(
  overrides: Partial<DualSyncCanonicalSnapshot> = {},
): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: 'Tasty',
      contactPhone: null,
      address: '1 Main',
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

function defaultPinsFor(
  fieldKey: string,
  snapshots: {
    readonly coreSnapshot: DualSyncCanonicalSnapshot;
    readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  },
): Pick<DualSyncPublishDecision, 'pinnedCoreHash' | 'pinnedGbpHash'> {
  const registry = buildRegistry({
    coreSnapshot: snapshots.coreSnapshot,
    gbpSnapshot: snapshots.gbpSnapshot,
    includeCoreOnly: false,
  });
  const config = findFieldConfig(registry, fieldKey);
  if (!config) return { pinnedCoreHash: null, pinnedGbpHash: null };
  const coreValue = valueForField(snapshots.coreSnapshot, config, 'core');
  const gbpValue = valueForField(snapshots.gbpSnapshot, config, 'gbp');
  return {
    pinnedCoreHash: hashCanonicalJson(config.canonicalizeCoreValue(coreValue)),
    pinnedGbpHash: hashCanonicalJson(config.canonicalizeGbpValue(gbpValue)),
  };
}

function makeDecision(
  overrides: Partial<DualSyncPublishDecision> = {},
  snapshots = { coreSnapshot: makeSnapshot(), gbpSnapshot: makeSnapshot() },
): DualSyncPublishDecision {
  const base = {
    fieldKey: overrides.fieldKey ?? 'profile.businessDescription',
    sectionKey: overrides.sectionKey ?? 'profile',
    action: overrides.action ?? 'export_to_google',
  } satisfies Omit<DualSyncPublishDecision, 'pinnedCoreHash' | 'pinnedGbpHash'>;
  return {
    ...base,
    ...defaultPinsFor(base.fieldKey, snapshots),
    ...overrides,
  };
}

function evaluate(
  decision: DualSyncPublishDecision,
  overrides: Partial<Parameters<typeof evaluatePublishDecision>[0]> = {},
) {
  const coreSnapshot = overrides.coreSnapshot ?? makeSnapshot();
  const gbpSnapshot = overrides.gbpSnapshot ?? makeSnapshot();
  const registry =
    overrides.registry ?? buildRegistry({ coreSnapshot, gbpSnapshot, includeCoreOnly: false });
  return evaluatePublishDecision({
    decision,
    registry,
    coreSnapshot,
    gbpSnapshot,
    runtimeFlags,
    actorUserId: 'user-1',
    ...overrides,
  });
}

describe('evaluatePublishDecision', () => {
  it('returns a failure for unknown fields', () => {
    expect(
      evaluate({
        fieldKey: 'profile.unknown',
        sectionKey: 'profile',
        action: 'export_to_google',
        pinnedCoreHash: null,
        pinnedGbpHash: null,
      }),
    ).toEqual({
      status: 'failed',
      fieldKey: 'profile.unknown',
      failure: {
        code: 'INVALID_DECISION',
        message: 'Unknown field key profile.unknown.',
        retryable: false,
      },
    });
  });

  it('passes through preflight failures before operation evaluation', () => {
    const decision = makeDecision();

    expect(
      evaluate(decision, {
        preflightFailure: {
          code: 'GOOGLE_VALIDATION_FAILED',
          message: 'Preflight failed.',
          retryable: false,
        },
      }),
    ).toEqual({
      status: 'failed',
      fieldKey: 'profile.businessDescription',
      failure: {
        code: 'GOOGLE_VALIDATION_FAILED',
        message: 'Preflight failed.',
        retryable: false,
      },
    });
  });

  it('returns ignored decisions without operation metadata', () => {
    expect(evaluate(makeDecision({ action: 'ignore' }))).toEqual({
      status: 'ignored',
      decision: makeDecision({ action: 'ignore' }),
    });
  });

  it('returns operation metadata for validated export decisions', () => {
    expect(evaluate(makeDecision())).toMatchObject({
      status: 'ready',
      direction: 'export_to_google',
      operationGroupKey: 'export_to_google:profile:location.profile',
      writeGroup: 'location.profile',
      googleUpdateMask: 'profile',
    });
  });

  it('blocks export decisions when runtime flags disable exports', () => {
    expect(
      evaluate(makeDecision(), {
        runtimeFlags: { ...runtimeFlags, exportEnabled: false },
      }),
    ).toMatchObject({
      status: 'failed',
      fieldKey: 'profile.businessDescription',
      failure: {
        code: 'UNSUPPORTED_FIELD',
        message: 'Google exports are disabled for this deployment.',
      },
    });
  });
});
