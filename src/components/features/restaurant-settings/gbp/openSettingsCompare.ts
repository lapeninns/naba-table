import { PROFILE_WORKSPACE_COMPARE_SECTION_KEYS } from './profileCompareSections';

import type { FamilyKey } from '../businessContextModel';
import type { GbpDriftFilter, GbpDriftOpenOptions } from '../gbp-drift/types';
import type { DualSyncSectionKey } from '@/server/dual-sync';

type OpenCompare = (options?: GbpDriftOpenOptions) => void;

type DiscoveryCompareFamily = Extract<
  FamilyKey,
  'attributes' | 'categories' | 'serviceAreas' | 'serviceItems'
>;

const DISCOVERY_FAMILY_COMPARE_SECTION_KEYS = {
  categories: 'businessContext.categories',
  serviceAreas: 'businessContext.serviceAreas',
  attributes: 'businessContext.attributes',
  serviceItems: 'businessContext.serviceItems',
} as const satisfies Record<DiscoveryCompareFamily, DualSyncSectionKey>;

export type SettingsComparePreset =
  | {
      readonly preset: 'profileWorkspace';
      readonly reviewCount: number;
    }
  | {
      readonly preset: 'discoveryFamily';
      readonly family: DiscoveryCompareFamily;
      readonly filter?: GbpDriftFilter;
    }
  | {
      readonly preset: 'globalDrifted';
      readonly filter?: GbpDriftFilter;
    }
  | {
      readonly preset: 'field';
      readonly fieldKey: string;
      readonly sectionKey: DualSyncSectionKey;
      readonly filter?: GbpDriftFilter;
    };

export function getSettingsCompareOptions(preset: SettingsComparePreset): GbpDriftOpenOptions {
  switch (preset.preset) {
    case 'profileWorkspace':
      return {
        sectionKeys: PROFILE_WORKSPACE_COMPARE_SECTION_KEYS,
        filter: preset.reviewCount > 0 ? 'drifted_only' : 'all',
      };
    case 'discoveryFamily':
      return {
        sectionKey: DISCOVERY_FAMILY_COMPARE_SECTION_KEYS[preset.family],
        filter: preset.filter ?? 'drifted_only',
      };
    case 'globalDrifted':
      return {
        filter: preset.filter ?? 'drifted_only',
      };
    case 'field': {
      const options: GbpDriftOpenOptions = {
        fieldKey: preset.fieldKey,
        sectionKey: preset.sectionKey,
      };
      return preset.filter ? { ...options, filter: preset.filter } : options;
    }
  }
}

export function openSettingsCompare(openCompare: OpenCompare, preset: SettingsComparePreset) {
  openCompare(getSettingsCompareOptions(preset));
}

export function openProfileWorkspaceCompare(openCompare: OpenCompare, reviewCount: number) {
  openSettingsCompare(openCompare, {
    preset: 'profileWorkspace',
    reviewCount,
  });
}
