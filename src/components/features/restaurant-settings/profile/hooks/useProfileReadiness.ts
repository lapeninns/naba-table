'use client';

import { useCallback, useMemo } from 'react';

import { deriveReadiness, type ReadinessItemKey } from '../../restaurantProfileModel';
import { getProfileReadinessStageLabel } from '../profileReadinessStage';
import { READINESS_FIELD_TARGETS } from '../profileReadinessTargets';
import { PROFILE_SECTION_DEFINITIONS, type ProfileSectionId } from '../profileSections';

import type { RestaurantDetailsFormValues } from '@/components/ops/restaurants/RestaurantDetailsForm';

type UseProfileReadinessInput = {
  previewValues: RestaurantDetailsFormValues;
  previewLogoUrl: string | null;
  setActiveSectionId: (sectionId: ProfileSectionId) => void;
};

export function useProfileReadiness({
  previewValues,
  previewLogoUrl,
  setActiveSectionId,
}: UseProfileReadinessInput) {
  const readiness = useMemo(
    () => deriveReadiness(previewValues, previewLogoUrl),
    [previewLogoUrl, previewValues],
  );
  const missingRequiredSectionIds = useMemo(() => {
    const ids = new Set<ProfileSectionId>();
    readiness.missingRequired.forEach((item) => {
      const section = PROFILE_SECTION_DEFINITIONS.find(
        (definition) => item.href === `#${definition.legacyHash}`,
      );
      if (section) {
        ids.add(section.id);
      }
    });
    return ids;
  }, [readiness.missingRequired]);
  const readinessStageLabel = getProfileReadinessStageLabel(readiness.score);
  const nextReadinessItem = readiness.missingRequired[0] ?? null;
  const handleFocusReadinessItem = useCallback(
    (key: ReadinessItemKey) => {
      const target = READINESS_FIELD_TARGETS[key];
      if (!target) {
        return;
      }

      setActiveSectionId(target.sectionId);
      requestAnimationFrame(() => {
        const field = document.getElementById(target.fieldId);
        if (field instanceof HTMLElement) {
          field.focus({ preventScroll: true });
          if (typeof field.animate === 'function') {
            field.animate(
              [
                { boxShadow: '0 0 0 0 hsl(var(--primary) / 0)' },
                { boxShadow: '0 0 0 4px hsl(var(--primary) / 0.24)' },
                { boxShadow: '0 0 0 0 hsl(var(--primary) / 0)' },
              ],
              { duration: 900, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
            );
          }
        }
      });
    },
    [setActiveSectionId],
  );

  return {
    readiness,
    missingRequiredSectionIds,
    readinessStageLabel,
    nextReadinessItem,
    handleFocusReadinessItem,
  };
}
