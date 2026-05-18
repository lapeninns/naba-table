'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import {
  type RestaurantDetailsDraftValues,
  type RestaurantDetailsFormValues,
} from '@/components/ops/restaurants/RestaurantDetailsForm';
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';

import {
  PROFILE_DIRTY_SECTIONS,
  buildProfileValues,
  type ProfileDirtyKey,
  type ProfileDirtySection,
} from '../../restaurantProfileModel';

import type { RestaurantProfile } from '@/services/ops/restaurants';

export function useProfileDraftState(data: RestaurantProfile | null | undefined) {
  const [dirtyState, setDirtyState] = useState<Record<ProfileDirtyKey, boolean>>({
    brand: false,
    contact: false,
    notifications: false,
    discovery: false,
    advanced: false,
  });
  const [sectionDrafts, setSectionDrafts] = useState<
    Partial<Record<ProfileDirtyKey, RestaurantDetailsDraftValues>>
  >({});
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null | undefined>(undefined);
  const resetDraftHandlersRef = useRef<Partial<Record<ProfileDirtyKey, () => void>>>({});

  const formDirty = Object.values(dirtyState).some(Boolean);
  const dirtySections = useMemo(
    () => PROFILE_DIRTY_SECTIONS.filter((item) => dirtyState[item.key]),
    [dirtyState],
  );
  const dirtyFormSections = useMemo(
    () =>
      dirtySections.filter(
        (section): section is ProfileDirtySection & { formId: string } =>
          typeof section.formId === 'string',
      ),
    [dirtySections],
  );

  useRegisterOpsUnsavedChanges(
    'restaurant-profile',
    formDirty,
    'You have unsaved restaurant profile changes. Leave without saving them?',
  );

  const initialValues = useMemo<RestaurantDetailsFormValues>(() => {
    return buildProfileValues(data);
  }, [data]);
  const draftValues = useMemo<RestaurantDetailsDraftValues>(
    () =>
      (['brand', 'contact', 'notifications', 'advanced'] as const).reduce(
        (result, key) => ({ ...result, ...(sectionDrafts[key] ?? {}) }),
        {},
      ),
    [sectionDrafts],
  );
  const previewValues = useMemo<RestaurantDetailsFormValues>(
    () => ({ ...initialValues, ...draftValues }),
    [draftValues, initialValues],
  );
  const previewLogoUrl = logoPreviewUrl === undefined ? (data?.logoUrl ?? null) : logoPreviewUrl;

  const updateDirtyState = useCallback((key: ProfileDirtyKey, dirty: boolean) => {
    setDirtyState((current) => (current[key] === dirty ? current : { ...current, [key]: dirty }));
  }, []);
  const dirtyHandlers = useMemo<Record<ProfileDirtyKey, (dirty: boolean) => void>>(
    () => ({
      // Stable handlers prevent every subform dirty-effect from rerunning on unrelated profile renders.
      brand: (dirty) => updateDirtyState('brand', dirty),
      contact: (dirty) => updateDirtyState('contact', dirty),
      notifications: (dirty) => updateDirtyState('notifications', dirty),
      discovery: (dirty) => updateDirtyState('discovery', dirty),
      advanced: (dirty) => updateDirtyState('advanced', dirty),
    }),
    [updateDirtyState],
  );
  const updateSectionDraft = useCallback(
    (key: ProfileDirtyKey, draft: RestaurantDetailsDraftValues, dirty: boolean) => {
      setSectionDrafts((current) => {
        if (!dirty) {
          if (!current[key]) {
            return current;
          }
          const next = { ...current };
          delete next[key];
          return next;
        }

        return { ...current, [key]: draft };
      });
    },
    [],
  );
  const draftHandlers = useMemo<
    Partial<Record<ProfileDirtyKey, (draft: RestaurantDetailsDraftValues, dirty: boolean) => void>>
  >(
    () => ({
      brand: (draft, dirty) => updateSectionDraft('brand', draft, dirty),
      contact: (draft, dirty) => updateSectionDraft('contact', draft, dirty),
      notifications: (draft, dirty) => updateSectionDraft('notifications', draft, dirty),
      advanced: (draft, dirty) => updateSectionDraft('advanced', draft, dirty),
    }),
    [updateSectionDraft],
  );
  const registerResetDraftHandler = useCallback(
    (key: ProfileDirtyKey, resetDraft: (() => void) | null) => {
      if (!resetDraft) {
        delete resetDraftHandlersRef.current[key];
        return;
      }
      resetDraftHandlersRef.current[key] = resetDraft;
    },
    [],
  );
  const resetSectionDraft = useCallback((key: ProfileDirtyKey) => {
    resetDraftHandlersRef.current[key]?.();
  }, []);

  return {
    dirtyState,
    dirtySections,
    dirtyFormSections,
    formDirty,
    initialValues,
    previewValues,
    previewLogoUrl,
    setLogoPreviewUrl,
    dirtyHandlers,
    draftHandlers,
    registerResetDraftHandler,
    resetSectionDraft,
  };
}
