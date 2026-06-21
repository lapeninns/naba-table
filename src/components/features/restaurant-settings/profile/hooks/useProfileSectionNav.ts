'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  PROFILE_SECTION_DEFINITIONS,
  findProfileSection,
  findProfileSectionByLegacyHash,
  type ProfileSectionId,
} from '../profileSections';
import { clearProfileUrlHash } from '../profileUrlHash';

import type { ProfileDirtyKey } from '../../restaurantProfileModel';
import type { RestaurantSettingsCommandRailItem } from '../../shared';

const DEFAULT_ACTIVE_SECTION_ID: ProfileSectionId = 'brand';

type BuildRailItemsInput = {
  dirtyState: Record<ProfileDirtyKey, boolean>;
  missingRequiredSectionIds: ReadonlySet<ProfileSectionId>;
};

export function useProfileSectionNav() {
  const [activeSectionId, setActiveSectionId] =
    useState<ProfileSectionId>(DEFAULT_ACTIVE_SECTION_ID);

  useEffect(() => {
    const applyLegacyHash = () => {
      const raw = window.location.hash.slice(1);
      if (!raw) {
        return;
      }
      const section = findProfileSectionByLegacyHash(raw);
      if (section) {
        setActiveSectionId(section.id);
      }
      clearProfileUrlHash();
    };

    applyLegacyHash();
    window.addEventListener('hashchange', applyLegacyHash);
    return () => window.removeEventListener('hashchange', applyLegacyHash);
  }, []);

  const activeSection = useMemo(() => findProfileSection(activeSectionId), [activeSectionId]);
  const handleSelectProfileSection = useCallback((sectionId: ProfileSectionId) => {
    setActiveSectionId(sectionId);
  }, []);
  const buildRailItems = useCallback(
    ({
      dirtyState,
      missingRequiredSectionIds,
    }: BuildRailItemsInput): RestaurantSettingsCommandRailItem[] =>
      PROFILE_SECTION_DEFINITIONS.map((section) => {
        const isDirty = dirtyState[section.dirtyKey];
        const isMissingRequired = missingRequiredSectionIds.has(section.id);
        return {
          label: section.setupStep
            ? `${section.setupStep} · ${section.navLabel}`
            : section.navLabel,
          isActive: section.id === activeSectionId,
          onSelect: () => handleSelectProfileSection(section.id),
          Icon: section.icon,
          badge: isDirty ? 'Draft' : isMissingRequired ? 'Required' : undefined,
        };
      }),
    [activeSectionId, handleSelectProfileSection],
  );

  return {
    activeSectionId,
    activeSection,
    setActiveSectionId,
    handleSelectProfileSection,
    buildRailItems,
  };
}
