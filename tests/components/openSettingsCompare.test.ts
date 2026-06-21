import { describe, expect, it, vi } from 'vitest';

import {
  getSettingsCompareOptions,
  openProfileWorkspaceCompare,
  openSettingsCompare,
} from '@/components/features/restaurant-settings/gbp/openSettingsCompare';
import { PROFILE_WORKSPACE_COMPARE_SECTION_KEYS } from '@/components/features/restaurant-settings/gbp/profileCompareSections';

describe('openSettingsCompare', () => {
  it('opens the profile workspace with the canonical section list', () => {
    const openCompare = vi.fn();

    openProfileWorkspaceCompare(openCompare, 2);

    expect(openCompare).toHaveBeenCalledWith({
      sectionKeys: PROFILE_WORKSPACE_COMPARE_SECTION_KEYS,
      filter: 'drifted_only',
    });
  });

  it('shows all profile fields when no review count is present', () => {
    expect(
      getSettingsCompareOptions({
        preset: 'profileWorkspace',
        reviewCount: 0,
      }),
    ).toEqual({
      sectionKeys: PROFILE_WORKSPACE_COMPARE_SECTION_KEYS,
      filter: 'all',
    });
  });

  it('maps discovery family presets to their GBP sections', () => {
    expect(
      getSettingsCompareOptions({
        preset: 'discoveryFamily',
        family: 'serviceAreas',
      }),
    ).toEqual({
      sectionKey: 'businessContext.serviceAreas',
      filter: 'drifted_only',
    });
  });

  it('opens a single field compare preset', () => {
    const openCompare = vi.fn();

    openSettingsCompare(openCompare, {
      preset: 'field',
      fieldKey: 'profile.name',
      sectionKey: 'profile',
    });

    expect(openCompare).toHaveBeenCalledWith({
      fieldKey: 'profile.name',
      sectionKey: 'profile',
    });
  });
});
