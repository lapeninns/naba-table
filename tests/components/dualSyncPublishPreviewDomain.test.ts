import { describe, expect, it } from 'vitest';

import {
  DUAL_SYNC_PUBLISH_RISK_VARIANT,
  buildDualSyncPublishGroupTableRows,
  buildDualSyncPublishPreviewSummaryBadges,
  formatPublishPreviewFieldLabel,
  formatPublishPreviewSectionLabel,
  formatPublishPreviewWarningLabel,
  isPublishPreviewConfirmDisabled,
  requiresPublishPreviewAcknowledgement,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncPublishPreviewDomain';

import type { DualSyncPublishPlan } from '@/server/dual-sync/publish/types';

function makePlan(overrides: Partial<DualSyncPublishPlan> = {}): DualSyncPublishPlan {
  return {
    restaurantId: 'restaurant-1',
    coreSnapshotHash: 'core-hash',
    gbpSnapshotHash: 'gbp-hash',
    acceptedCount: 1,
    rejectedCount: 0,
    ignoredCount: 0,
    groups: [
      {
        groupId: 'export_to_google:profile:location.profile',
        direction: 'export_to_google',
        sectionKey: 'profile',
        writeGroup: 'location.profile',
        fields: [
          {
            fieldKey: 'profile.phone',
            sectionKey: 'profile',
            action: 'export_to_google',
            pinnedCoreHash: 'core-phone',
            pinnedGbpHash: 'gbp-phone',
          },
        ],
        riskLevel: 'critical',
        requiresPreflight: true,
        requiresManualConfirmation: true,
        destructiveWritePossible: true,
        googleUpdateMasks: ['phoneNumbers'],
      },
    ],
    rejected: [],
    warnings: [],
    ...overrides,
  };
}

describe('dualSyncPublishPreviewDomain', () => {
  it('formats publish preview labels and badge variants', () => {
    expect(formatPublishPreviewSectionLabel('profile')).toBe('Profile');
    expect(formatPublishPreviewSectionLabel('unknown.section')).toBe('unknown.section');
    expect(formatPublishPreviewWarningLabel('DESTRUCTIVE_WRITE')).toBe('Destructive write');
    expect(formatPublishPreviewWarningLabel('PREFLIGHT_REQUIRED')).toBe('Preflight required');
    expect(formatPublishPreviewWarningLabel('HIGH_RISK')).toBe('High risk');
    expect(formatPublishPreviewFieldLabel(1)).toBe('field');
    expect(formatPublishPreviewFieldLabel(2)).toBe('fields');
    expect(DUAL_SYNC_PUBLISH_RISK_VARIANT.critical).toBe('status-cancelled');
  });

  it('requires acknowledgement for high-risk groups, destructive groups, manual groups, and warnings', () => {
    expect(requiresPublishPreviewAcknowledgement(makePlan())).toBe(true);
    expect(
      requiresPublishPreviewAcknowledgement(
        makePlan({
          groups: [],
          warnings: [{ code: 'HIGH_RISK', message: 'Review before publishing.' }],
        }),
      ),
    ).toBe(true);
    expect(
      requiresPublishPreviewAcknowledgement(
        makePlan({
          groups: [
            {
              ...makePlan().groups[0]!,
              riskLevel: 'low',
              requiresManualConfirmation: false,
              destructiveWritePossible: false,
            },
          ],
        }),
      ),
    ).toBe(false);
    expect(requiresPublishPreviewAcknowledgement(null)).toBe(false);
  });

  it('disables publish while publishing, when nothing is accepted, or before required acknowledgement', () => {
    expect(
      isPublishPreviewConfirmDisabled({
        isPublishing: true,
        acceptedCount: 1,
        needsAcknowledgement: false,
        acknowledged: false,
      }),
    ).toBe(true);
    expect(
      isPublishPreviewConfirmDisabled({
        isPublishing: false,
        acceptedCount: 0,
        needsAcknowledgement: false,
        acknowledged: false,
      }),
    ).toBe(true);
    expect(
      isPublishPreviewConfirmDisabled({
        isPublishing: false,
        acceptedCount: 1,
        needsAcknowledgement: true,
        acknowledged: false,
      }),
    ).toBe(true);
    expect(
      isPublishPreviewConfirmDisabled({
        isPublishing: false,
        acceptedCount: 1,
        needsAcknowledgement: true,
        acknowledged: true,
      }),
    ).toBe(false);
  });

  it('builds publish group table rows with display labels and fallbacks', () => {
    const [exportRow, importRow] = buildDualSyncPublishGroupTableRows([
      makePlan().groups[0]!,
      {
        ...makePlan().groups[0]!,
        groupId: 'import_from_google:unknown.section:location.profile',
        direction: 'import_from_google',
        sectionKey: 'unknown.section',
        fields: [
          {
            fieldKey: 'profile.website',
            sectionKey: 'profile',
            action: 'import_from_google',
            pinnedCoreHash: 'core-website',
            pinnedGbpHash: 'gbp-website',
          },
          {
            fieldKey: 'profile.name',
            sectionKey: 'profile',
            action: 'import_from_google',
            pinnedCoreHash: 'core-name',
            pinnedGbpHash: 'gbp-name',
          },
        ],
        riskLevel: 'low',
        googleUpdateMasks: [],
      },
    ]);

    expect(exportRow).toMatchObject({
      id: 'export_to_google:profile:location.profile',
      sectionLabel: 'Profile',
      writeGroup: 'location.profile',
      direction: 'export_to_google',
      directionIconKey: 'export',
      directionLabel: 'Export',
      riskLevel: 'critical',
      riskVariant: 'status-cancelled',
      masksLabel: 'phoneNumbers',
      fieldCount: 1,
    });
    expect(importRow).toMatchObject({
      id: 'import_from_google:unknown.section:location.profile',
      sectionLabel: 'unknown.section',
      direction: 'import_from_google',
      directionIconKey: 'import',
      directionLabel: 'Import',
      riskLevel: 'low',
      riskVariant: 'status-confirmed',
      masksLabel: '-',
      fieldCount: 2,
    });
  });

  it('builds publish preview summary badges with rejected state variants', () => {
    expect(buildDualSyncPublishPreviewSummaryBadges(makePlan())).toEqual([
      { id: 'accepted', label: '1 accepted', variant: 'metric' },
      { id: 'rejected', label: '0 rejected', variant: 'status-confirmed' },
      { id: 'ignored', label: '0 ignored', variant: 'secondary' },
      { id: 'writeGroups', label: '1 write groups', variant: 'outline' },
    ]);

    expect(
      buildDualSyncPublishPreviewSummaryBadges(
        makePlan({
          acceptedCount: 0,
          rejectedCount: 2,
          ignoredCount: 3,
          groups: [],
        }),
      ),
    ).toEqual([
      { id: 'accepted', label: '0 accepted', variant: 'metric' },
      { id: 'rejected', label: '2 rejected', variant: 'status-cancelled' },
      { id: 'ignored', label: '3 ignored', variant: 'secondary' },
      { id: 'writeGroups', label: '0 write groups', variant: 'outline' },
    ]);
  });
});
