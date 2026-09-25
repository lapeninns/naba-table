'use client';

import { useCallback, useEffect, useRef } from 'react';

import { emitProfileEditorAnalytics } from '../profileEditorAnalytics';

import type { deriveReadiness } from '../../restaurantProfileModel';
import type { ProfileSectionId } from '../profileSections';
import type { RestaurantProfile } from '@/services/ops/restaurants';

type UseProfileEditorAnalyticsInput = {
  restaurantId: string | null;
  data: RestaurantProfile | null | undefined;
  dirtySectionIds: readonly ProfileSectionId[];
  formDirty: boolean;
  readiness: ReturnType<typeof deriveReadiness>;
};

export function useProfileEditorAnalytics({
  restaurantId,
  data,
  dirtySectionIds,
  formDirty,
  readiness,
}: UseProfileEditorAnalyticsInput) {
  const sessionStartedAtRef = useRef(Date.now());
  const viewedRestaurantIdRef = useRef<string | null>(null);
  const editStartedEmittedRef = useRef(false);
  const dropoffEmittedRef = useRef(false);
  const dirtySectionsRef = useRef<readonly ProfileSectionId[]>([]);

  const emitSaveAllClicked = useCallback(
    (sectionIds: readonly ProfileSectionId[]) => {
      emitProfileEditorAnalytics('restaurant_profile_save_all_clicked', {
        restaurant_id: restaurantId,
        dirty_section_count: sectionIds.length,
        dirty_sections: [...sectionIds],
        completeness_score: readiness.score,
        missing_count: readiness.missing.length,
        elapsed_ms: Math.max(0, Date.now() - sessionStartedAtRef.current),
      });
    },
    [readiness.missing.length, readiness.score, restaurantId],
  );

  useEffect(() => {
    dirtySectionsRef.current = dirtySectionIds;
  }, [dirtySectionIds]);

  useEffect(() => {
    if (!restaurantId || !data || viewedRestaurantIdRef.current === restaurantId) {
      return;
    }

    viewedRestaurantIdRef.current = restaurantId;
    sessionStartedAtRef.current = Date.now();
    editStartedEmittedRef.current = false;
    dropoffEmittedRef.current = false;

    emitProfileEditorAnalytics('restaurant_profile_editor_viewed', {
      restaurant_id: restaurantId,
      completeness_score: readiness.score,
      completed_count: readiness.completed.length,
      missing_count: readiness.missing.length,
      missing_fields: readiness.missing.map((item) => item.key),
    });
  }, [data, readiness.completed.length, readiness.missing, readiness.score, restaurantId]);

  useEffect(() => {
    if (!restaurantId || dirtySectionIds.length === 0 || editStartedEmittedRef.current) {
      return;
    }

    editStartedEmittedRef.current = true;
    dropoffEmittedRef.current = false;
    emitProfileEditorAnalytics('restaurant_profile_edit_started', {
      restaurant_id: restaurantId,
      dirty_section_count: dirtySectionIds.length,
      dirty_sections: [...dirtySectionIds],
      completeness_score: readiness.score,
      elapsed_ms: Math.max(0, Date.now() - sessionStartedAtRef.current),
    });
  }, [dirtySectionIds, readiness.score, restaurantId]);

  useEffect(() => {
    if (!formDirty) {
      dropoffEmittedRef.current = false;
      return;
    }

    const emitDropoff = () => {
      const currentDirtySections = dirtySectionsRef.current;
      if (!restaurantId || currentDirtySections.length === 0 || dropoffEmittedRef.current) {
        return;
      }

      dropoffEmittedRef.current = true;
      emitProfileEditorAnalytics('restaurant_profile_dropoff_before_save', {
        restaurant_id: restaurantId,
        dirty_section_count: currentDirtySections.length,
        dirty_sections: [...currentDirtySections],
        elapsed_ms: Math.max(0, Date.now() - sessionStartedAtRef.current),
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        emitDropoff();
      }
    };

    window.addEventListener('pagehide', emitDropoff, { passive: true });
    window.addEventListener('beforeunload', emitDropoff, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', emitDropoff);
      window.removeEventListener('beforeunload', emitDropoff);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [formDirty, restaurantId]);

  return { emitSaveAllClicked };
}
