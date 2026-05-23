import { describe, expect, it } from 'vitest';

import {
  buildPlannerWarnings,
  getPublishGroupKey,
  isExecutablePublishDecision,
  maxRisk,
  plannerFailure,
  uniqueGoogleUpdateMasks,
  upsertPlannerGroup,
} from '@/server/dual-sync/publish/planner-domain';

import type {
  GroupAccumulator,
  UpsertPlannerGroupInput,
} from '@/server/dual-sync/publish/planner-domain';
import type { DualSyncPublishDecision } from '@/server/dual-sync/publish/types';

function decision(overrides: Partial<DualSyncPublishDecision> = {}): DualSyncPublishDecision & {
  readonly action: 'import_from_google' | 'export_to_google';
} {
  return {
    fieldKey: 'profile.businessDescription',
    sectionKey: 'profile',
    action: 'export_to_google',
    pinnedCoreHash: 'core-hash',
    pinnedGbpHash: 'gbp-hash',
    ...overrides,
  } as DualSyncPublishDecision & {
    readonly action: 'import_from_google' | 'export_to_google';
  };
}

function upsert(
  groups: Map<string, GroupAccumulator>,
  overrides: Partial<UpsertPlannerGroupInput> = {},
) {
  upsertPlannerGroup({
    groups,
    decision: decision(),
    writeGroup: 'location.profile',
    riskLevel: 'medium',
    requiresPreflight: false,
    requiresManualConfirmation: false,
    destructiveWritePossible: false,
    googleUpdateMasks: ['profile'],
    ...overrides,
  });
}

describe('dual-sync publish planner domain', () => {
  it('builds stable failure objects and group keys', () => {
    expect(plannerFailure('No write group.')).toEqual({
      code: 'UNSUPPORTED_FIELD',
      message: 'No write group.',
      retryable: false,
    });
    expect(plannerFailure('Stale core.', 'CORE_DRIFT')).toEqual({
      code: 'CORE_DRIFT',
      message: 'Stale core.',
      retryable: false,
    });
    expect(
      getPublishGroupKey({
        direction: 'export_to_google',
        sectionKey: 'profile',
        writeGroup: 'location.profile',
      }),
    ).toBe('export_to_google:profile:location.profile');
  });

  it('narrows executable decisions for planner grouping', () => {
    expect(isExecutablePublishDecision(decision())).toBe(true);
    expect(isExecutablePublishDecision({ ...decision(), action: 'import_from_google' })).toBe(true);
    expect(isExecutablePublishDecision({ ...decision(), action: 'ignore' })).toBe(false);
  });

  it('orders risk levels and de-dupes Google update masks without reordering first use', () => {
    expect(maxRisk('low', 'critical')).toBe('critical');
    expect(maxRisk('high', 'medium')).toBe('high');
    expect(uniqueGoogleUpdateMasks(['profile', undefined, 'title', 'profile'])).toEqual([
      'profile',
      'title',
    ]);
  });

  it('creates and merges planner groups while escalating metadata', () => {
    const groups = new Map<string, GroupAccumulator>();
    upsert(groups);
    upsert(groups, {
      decision: decision({ fieldKey: 'profile.name' }),
      riskLevel: 'critical',
      requiresPreflight: true,
      requiresManualConfirmation: true,
      destructiveWritePossible: true,
      googleUpdateMasks: ['title', 'profile'],
    });

    const [group] = [...groups.values()];
    expect(group).toMatchObject({
      groupId: 'export_to_google:profile:location.profile',
      direction: 'export_to_google',
      sectionKey: 'profile',
      writeGroup: 'location.profile',
      riskLevel: 'critical',
      requiresPreflight: true,
      requiresManualConfirmation: true,
      destructiveWritePossible: true,
      googleUpdateMasks: ['profile', 'title'],
    });
    expect(group?.fields.map((field) => field.fieldKey)).toEqual([
      'profile.businessDescription',
      'profile.name',
    ]);
  });

  it('emits warnings for preflight, manual confirmation, and destructive writes', () => {
    const groups = new Map<string, GroupAccumulator>();
    upsert(groups, {
      requiresPreflight: true,
      requiresManualConfirmation: true,
      destructiveWritePossible: true,
    });

    expect(buildPlannerWarnings([...groups.values()]).map((warning) => warning.code)).toEqual([
      'PREFLIGHT_REQUIRED',
      'HIGH_RISK',
      'DESTRUCTIVE_WRITE',
    ]);
  });
});
