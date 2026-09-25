import {
  DISCOVERY_SECTION_DESCRIPTIONS,
  DISCOVERY_SECTION_ORDER,
  DISCOVERY_SECTION_TITLES,
  discoverySectionAnchorId,
  type DirtyState,
  type FamilyKey,
} from '../businessContextModel';
import { pluralise } from '../shared/settingsSaveSequence';

import type { SettingsSectionNavBadge } from '../shared/SettingsSectionNav';

export type DiscoverySectionState = {
  family: FamilyKey;
  title: string;
  description: string;
  anchorId: string;
  dirty: boolean;
  /** Issues shown to staff in this section (after a save attempt or once a field is left). */
  issueCount: number;
  badge: SettingsSectionNavBadge | null;
};

/** "N issues" wins over "Edited": staff need to see where the blocking problems are. */
export function getDiscoverySectionBadge({
  dirty,
  issueCount,
}: {
  dirty: boolean;
  issueCount: number;
}): SettingsSectionNavBadge | null {
  if (issueCount > 0) {
    return { label: pluralise(issueCount, 'issue'), tone: 'issue' };
  }
  if (dirty) {
    return { label: 'Edited', tone: 'edited', srLabel: 'Unsaved changes' };
  }
  return null;
}

export function buildDiscoverySectionStates({
  dirty,
  issueCounts,
}: {
  dirty: DirtyState;
  issueCounts: Readonly<Record<FamilyKey, number>>;
}): DiscoverySectionState[] {
  return DISCOVERY_SECTION_ORDER.map((family) => {
    const issueCount = issueCounts[family];
    return {
      family,
      title: DISCOVERY_SECTION_TITLES[family],
      description: DISCOVERY_SECTION_DESCRIPTIONS[family],
      anchorId: discoverySectionAnchorId(family),
      dirty: dirty[family],
      issueCount,
      badge: getDiscoverySectionBadge({ dirty: dirty[family], issueCount }),
    };
  });
}
