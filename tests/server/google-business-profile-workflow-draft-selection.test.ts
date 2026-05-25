import { describe, expect, it } from 'vitest';

import {
  detectStaleSections,
  selectedItems,
  selectedSectionKeys,
  validateAndStampFieldDecisions,
} from '@/server/google-business-profile/workflowDraftSelection';

type SectionKey = 'profile' | 'operatingHours';

function buildItem(
  fieldKey: string,
  overrides: Partial<{
    sectionKey: SectionKey;
    label: string;
    selected: boolean;
    canPublishToNabatable: boolean;
    canPushToGoogle: boolean;
    canImportFromGoogle: boolean;
    canExportToGoogle: boolean;
    canIgnore: boolean;
    nabatableValueHash: string;
    googleValueHash: string;
    status: string;
  }> = {},
) {
  return {
    fieldKey,
    label: overrides.label ?? fieldKey,
    sectionKey: overrides.sectionKey ?? 'profile',
    status: overrides.status ?? 'ready',
    selected: overrides.selected ?? false,
    nabatableValueHash: overrides.nabatableValueHash ?? `${fieldKey}-nabatable`,
    googleValueHash: overrides.googleValueHash ?? `${fieldKey}-google`,
    capabilities: {
      canImportFromGoogle: overrides.canImportFromGoogle ?? true,
      canExportToGoogle: overrides.canExportToGoogle ?? true,
      canIgnore: overrides.canIgnore ?? true,
    },
    canPublishToNabatable: overrides.canPublishToNabatable ?? true,
    canPushToGoogle: overrides.canPushToGoogle ?? true,
  };
}

function buildDraft() {
  const profileName = buildItem('profile.name');
  const profilePhone = buildItem('profile.contactPhone');
  const operatingHoursMonday = buildItem('operatingHours.weekly.1', {
    sectionKey: 'operatingHours',
  });

  return {
    sectionDiffs: [
      {
        sectionKey: 'profile' as const,
        items: [profileName, profilePhone],
      },
      {
        sectionKey: 'operatingHours' as const,
        items: [operatingHoursMonday],
      },
    ],
    decisions: [],
    coreSnapshotHashes: {
      profile: 'profile-old',
      operatingHours: 'hours-current',
    },
  };
}

describe('google business profile workflow draft selection helpers', () => {
  it('stamps valid decisions once per section and field', () => {
    const draft = buildDraft();
    const decisions = validateAndStampFieldDecisions({
      draft,
      actorUserId: 'user-1',
      decidedAt: '2026-05-21T20:26:00.000Z',
      decisions: [
        {
          sectionKey: 'profile',
          fieldKey: 'profile.name',
          action: 'import_from_google',
          reviewedNabatableValueHash: 'profile.name-nabatable',
          reviewedGoogleValueHash: 'profile.name-google',
        },
        {
          sectionKey: 'profile',
          fieldKey: 'profile.name',
          action: 'export_to_google',
          reviewedNabatableValueHash: 'profile.name-nabatable',
          reviewedGoogleValueHash: 'profile.name-google',
        },
      ],
    });

    expect(decisions).toEqual([
      {
        sectionKey: 'profile',
        fieldKey: 'profile.name',
        action: 'import_from_google',
        reviewedNabatableValueHash: 'profile.name-nabatable',
        reviewedGoogleValueHash: 'profile.name-google',
        decidedByUserId: 'user-1',
        decidedAt: '2026-05-21T20:26:00.000Z',
      },
    ]);
  });

  it('rejects decisions whose reviewed hashes no longer match the draft item', () => {
    let captured: Error | null = null;
    try {
      validateAndStampFieldDecisions({
        draft: buildDraft(),
        actorUserId: 'user-1',
        decidedAt: '2026-05-21T20:26:00.000Z',
        decisions: [
          {
            sectionKey: 'profile',
            fieldKey: 'profile.name',
            action: 'import_from_google',
            reviewedNabatableValueHash: 'stale-nabatable',
            reviewedGoogleValueHash: 'profile.name-google',
          },
        ],
      });
    } catch (error) {
      captured = error as Error;
    }

    expect(captured?.name).toBe('GBP_DECISION_INVALID');
    expect(captured?.message).toMatch(/changed in Nabatable/i);
  });

  it('selects decision-backed items by publish mode', () => {
    const draft = {
      ...buildDraft(),
      decisions: [
        {
          sectionKey: 'profile' as const,
          fieldKey: 'profile.name',
          action: 'import_from_google' as const,
          reviewedNabatableValueHash: 'profile.name-nabatable',
          reviewedGoogleValueHash: 'profile.name-google',
          decidedByUserId: 'user-1',
          decidedAt: '2026-05-21T20:26:00.000Z',
        },
        {
          sectionKey: 'profile' as const,
          fieldKey: 'profile.contactPhone',
          action: 'export_to_google' as const,
          reviewedNabatableValueHash: 'profile.contactPhone-nabatable',
          reviewedGoogleValueHash: 'profile.contactPhone-google',
          decidedByUserId: 'user-1',
          decidedAt: '2026-05-21T20:26:00.000Z',
        },
      ],
    };

    expect(selectedItems(draft, 'nabatable_only').map((item) => item.fieldKey)).toEqual([
      'profile.name',
    ]);
    expect(selectedItems(draft, 'google_only').map((item) => item.fieldKey)).toEqual([
      'profile.contactPhone',
    ]);
    expect(selectedItems(draft, 'nabatable_and_google').map((item) => item.fieldKey)).toEqual([
      'profile.name',
      'profile.contactPhone',
    ]);
  });

  it('selects legacy checkbox-backed sections and detects stale selected sections', () => {
    const draft = {
      ...buildDraft(),
      sectionDiffs: [
        {
          sectionKey: 'profile' as const,
          items: [buildItem('profile.name', { selected: true })],
        },
        {
          sectionKey: 'operatingHours' as const,
          items: [
            buildItem('operatingHours.weekly.1', {
              sectionKey: 'operatingHours',
              selected: true,
              canPushToGoogle: false,
            }),
          ],
        },
      ],
    };

    expect(selectedSectionKeys(draft)).toEqual(['profile', 'operatingHours']);
    expect(selectedItems(draft, 'google_only').map((item) => item.fieldKey)).toEqual([
      'profile.name',
    ]);
    expect(
      detectStaleSections(draft, {
        profile: 'profile-current',
        operatingHours: 'hours-current',
      }),
    ).toEqual(['profile']);
  });
});
