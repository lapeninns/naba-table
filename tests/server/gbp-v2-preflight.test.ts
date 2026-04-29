import { describe, expect, it } from 'vitest';

import { runPreflight } from '@/server/google-business-profile-v2/preflight/validator';
import { publishWiringTestUtils } from '@/server/google-business-profile-v2/publish/wiring';

import type { SyncV2Decision, SyncV2DiffItem } from '@/server/google-business-profile-v2/types';

function diffItem(overrides: Partial<SyncV2DiffItem<unknown, unknown>>): SyncV2DiffItem {
  return {
    sectionKey: 'profile',
    fieldKey: 'name',
    normalizedNabatableValue: 'Old Crown Girton',
    normalizedGoogleValue: 'Old Crown',
    nabatableValueHash: 'nh',
    googleValueHash: 'gh',
    capabilities: { canImport: true, canExport: true, canIgnore: true, googleUpdateMask: 'title' },
    sortOrder: 0,
    ...overrides,
  } as SyncV2DiffItem;
}

function decision(overrides: Partial<SyncV2Decision>): SyncV2Decision {
  return {
    id: 'd1',
    draftId: 'draft1',
    sectionKey: 'profile',
    fieldKey: 'name',
    action: 'import_from_google',
    nabatableValueHash: 'nh',
    googleValueHash: 'gh',
    decidedByUserId: 'u1',
    decidedAt: '2026-04-28T00:00:00Z',
    ...overrides,
  };
}

describe('runPreflight', () => {
  it('seals a single import-to-nabatable decision and freezes hashes', () => {
    const result = runPreflight({
      directionIntent: 'import_to_nabatable',
      diffItems: [diffItem({})],
      decisions: [decision({})],
      nabatableSnapshotHash: 'nab-snap',
      googleSnapshotHash: 'goo-snap',
      googleWriteEligible: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.directionIntent).toBe('import_to_nabatable');
      expect(result.result.publishablePlanItems).toHaveLength(1);
      expect(result.result.frozenNabatableSnapshotHash).toBe('nab-snap');
      expect(result.result.frozenGoogleSnapshotHash).toBe('goo-snap');
      expect(result.result.frozenDecisionsHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('rejects when a decision has stale value hashes', () => {
    const result = runPreflight({
      directionIntent: 'import_to_nabatable',
      diffItems: [diffItem({ nabatableValueHash: 'nh-changed' })],
      decisions: [decision({})],
      nabatableSnapshotHash: 'x',
      googleSnapshotHash: 'y',
      googleWriteEligible: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('V2_DECISION_STALE');
    }
  });

  it('rejects an export-to-Google action when capability is missing', () => {
    const result = runPreflight({
      directionIntent: 'export_to_google',
      diffItems: [
        diffItem({ capabilities: { canImport: true, canExport: false, canIgnore: true } }),
      ],
      decisions: [decision({ action: 'export_to_google' })],
      nabatableSnapshotHash: 'x',
      googleSnapshotHash: 'y',
      googleWriteEligible: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('V2_DECISION_NOT_EXPORTABLE');
    }
  });

  it('rejects mixed-direction selection in one publish', () => {
    const result = runPreflight({
      directionIntent: 'import_to_nabatable',
      diffItems: [diffItem({})],
      decisions: [decision({ action: 'export_to_google' })],
      nabatableSnapshotHash: 'x',
      googleSnapshotHash: 'y',
      googleWriteEligible: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('V2_DIRECTION_MISMATCH');
    }
  });

  it('rejects export when Google write eligibility is false', () => {
    const result = runPreflight({
      directionIntent: 'export_to_google',
      diffItems: [diffItem({})],
      decisions: [decision({ action: 'export_to_google' })],
      nabatableSnapshotHash: 'x',
      googleSnapshotHash: 'y',
      googleWriteEligible: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'V2_GOOGLE_WRITE_INELIGIBLE')).toBe(true);
    }
  });

  it('rejects when no decisions are publishable for the direction', () => {
    const result = runPreflight({
      directionIntent: 'import_to_nabatable',
      diffItems: [diffItem({})],
      decisions: [decision({ action: 'ignore' })],
      nabatableSnapshotHash: 'x',
      googleSnapshotHash: 'y',
      googleWriteEligible: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('V2_NO_PUBLISHABLE_ITEMS');
    }
  });

  it('aggregates Google update masks across export decisions', () => {
    const result = runPreflight({
      directionIntent: 'export_to_google',
      diffItems: [
        diffItem({
          fieldKey: 'name',
          capabilities: {
            canImport: true,
            canExport: true,
            canIgnore: true,
            googleUpdateMask: 'title',
          },
        }),
        diffItem({
          fieldKey: 'contactPhone',
          capabilities: {
            canImport: true,
            canExport: true,
            canIgnore: true,
            googleUpdateMask: 'phoneNumbers',
          },
        }),
      ],
      decisions: [
        decision({ fieldKey: 'name', action: 'export_to_google' }),
        decision({ fieldKey: 'contactPhone', action: 'export_to_google' }),
      ],
      nabatableSnapshotHash: 'x',
      googleSnapshotHash: 'y',
      googleWriteEligible: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.googleUpdateMasks).toEqual(
        expect.arrayContaining(['title', 'phoneNumbers']),
      );
    }
  });

  it('exports multienum attributes with raw Google enum IDs', () => {
    const payload = publishWiringTestUtils.buildGoogleAttribute({
      attributeKey: 'serves_beer',
      attributeName: 'attributes/serves_beer',
      attributeId: 'attributes/serves_beer',
      valueType: 'multienum',
      boolValue: null,
      textValue: null,
      uriValue: null,
      uriValues: [],
      enumValues: ['serves_beer_yes'],
      unsetEnumValues: ['serves_beer_no'],
    });

    expect(payload).toEqual({
      name: 'attributes/serves_beer',
      repeatedEnumValue: {
        setValues: ['serves_beer_yes'],
        unsetValues: ['serves_beer_no'],
      },
    });
  });
});
