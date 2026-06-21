import { DISCOVERY_SECTION_ORDER, type FamilyKey } from '../businessContextModel';

import type { RestaurantBusinessContextEditor } from '../useRestaurantBusinessContextEditor';

type DiscoverySummaryInput = Pick<
  RestaurantBusinessContextEditor,
  'activeTab' | 'coreCounts' | 'dirty' | 'errors' | 'seedSource'
>;

export type DiscoverySummary = {
  dirtyCount: number;
  errorCount: number;
  activeFamily: FamilyKey | '';
  nextFamily: FamilyKey | null;
};

export function buildDiscoverySummary(editor: DiscoverySummaryInput): DiscoverySummary {
  const dirtyFamilies = DISCOVERY_SECTION_ORDER.filter((family) => editor.dirty[family]);
  const errorFamilies = DISCOVERY_SECTION_ORDER.filter((family) => editor.errors[family]);

  let nextFamily: FamilyKey | null = null;
  for (const family of DISCOVERY_SECTION_ORDER) {
    if (editor.errors[family]) {
      nextFamily = family;
      break;
    }
    if (editor.dirty[family]) {
      nextFamily = family;
      break;
    }
    if (editor.seedSource[family] === 'provider') {
      nextFamily = family;
      break;
    }
    if (editor.coreCounts[family] === 0) {
      nextFamily = family;
      break;
    }
  }
  if (!nextFamily && editor.activeTab) {
    nextFamily = editor.activeTab;
  }

  return {
    dirtyCount: dirtyFamilies.length,
    errorCount: errorFamilies.length,
    activeFamily: editor.activeTab,
    nextFamily,
  };
}
