import { describe, expect, it } from 'vitest';

import {
  businessContextPayloadForDraft,
  googleMasksForDraft,
  operatingHoursSelectionForDraft,
  profileFieldsForDraft,
  selectedGooglePushAuditValues,
  servicePeriodsSelectionForDraft,
} from '@/server/google-business-profile/workflowDraftPayloads';

import type { RestaurantBusinessContextSnapshot } from '@/server/restaurants/businessContext';

type SectionKey = 'profile' | 'operatingHours' | 'servicePeriods' | 'businessContext.serviceAreas';

function buildItem(
  sectionKey: SectionKey,
  fieldKey: string,
  overrides: Partial<{
    selected: boolean;
    canPublishToNabatable: boolean;
    canPushToGoogle: boolean;
    currentValue: unknown;
    providerValue: unknown;
  }> = {},
) {
  return {
    fieldKey,
    label: fieldKey,
    sectionKey,
    status: 'ready',
    selected: overrides.selected ?? true,
    nabatableValueHash: `${fieldKey}:nabatable`,
    googleValueHash: `${fieldKey}:google`,
    capabilities: {
      canImportFromGoogle: true,
      canExportToGoogle: true,
      canIgnore: true,
    },
    canPublishToNabatable: overrides.canPublishToNabatable ?? true,
    canPushToGoogle: overrides.canPushToGoogle ?? true,
    currentValue: overrides.currentValue ?? `nabatable ${fieldKey}`,
    providerValue: overrides.providerValue ?? `google ${fieldKey}`,
  };
}

function buildDraft() {
  return {
    sectionDiffs: [
      {
        sectionKey: 'profile' as const,
        items: [
          buildItem('profile', 'profile.name'),
          buildItem('profile', 'profile.contactPhone'),
          buildItem('profile', 'profile.website'),
        ],
      },
      {
        sectionKey: 'operatingHours' as const,
        items: [
          buildItem('operatingHours', 'operatingHours.weekly.1'),
          buildItem('operatingHours', 'operatingHours.override.2026-05-21'),
        ],
      },
      {
        sectionKey: 'servicePeriods' as const,
        items: [
          buildItem('servicePeriods', 'servicePeriods.2.breakfast.start'),
          buildItem('servicePeriods', 'servicePeriods.all.summary'),
        ],
      },
    ],
    decisions: [],
    coreSnapshotHashes: {},
  };
}

describe('google business profile workflow draft payload helpers', () => {
  it('derives supported profile fields from selected profile draft items', () => {
    expect(profileFieldsForDraft(buildDraft(), 'google_only')).toEqual(['name', 'contactPhone']);
  });

  it('derives operating-hours and service-period selections from selected field keys', () => {
    expect(operatingHoursSelectionForDraft(buildDraft(), 'google_only')).toEqual({
      weeklyDays: [1],
      overrideDates: ['2026-05-21'],
    });
    expect(servicePeriodsSelectionForDraft(buildDraft(), 'google_only')).toEqual({
      dayOfWeeks: [2],
    });
  });

  it('builds Google update masks from selected push-capable draft items', () => {
    expect(googleMasksForDraft(buildDraft(), 'google_only')).toEqual([
      'title',
      'phoneNumbers',
      'regularHours',
      'specialHours',
      'moreHours',
    ]);
  });

  it('builds Google push audit values from selected push items', () => {
    const draft = {
      ...buildDraft(),
      sectionDiffs: [
        {
          sectionKey: 'profile' as const,
          items: [
            buildItem('profile', 'profile.name', {
              currentValue: 'Nabatable name',
              providerValue: 'Google name',
            }),
            buildItem('profile', 'profile.address', {
              canPushToGoogle: false,
              currentValue: 'Nabatable address',
              providerValue: 'Google address',
            }),
          ],
        },
      ],
    };

    expect(selectedGooglePushAuditValues(draft)).toEqual({
      'profile.name': {
        googleValue: 'Google name',
        nabatableValue: 'Nabatable name',
      },
    });
  });

  it('builds business-context payloads for selected business-context sections', () => {
    const draft = {
      sectionDiffs: [
        {
          sectionKey: 'businessContext.serviceAreas' as const,
          items: [buildItem('businessContext.serviceAreas', 'businessContext.serviceAreas.1')],
        },
      ],
      decisions: [],
      coreSnapshotHashes: {},
    };
    const current = {
      providerSnapshot: {
        categories: [],
        serviceAreas: [{ id: 'provider-area-1', placeId: 'place-1', label: 'Central' }],
        attributes: [],
        serviceItems: [],
      },
    } as unknown as RestaurantBusinessContextSnapshot;

    expect(businessContextPayloadForDraft(draft, current)).toEqual({
      serviceAreas: [{ placeId: 'place-1', label: 'Central' }],
    });
  });
});
