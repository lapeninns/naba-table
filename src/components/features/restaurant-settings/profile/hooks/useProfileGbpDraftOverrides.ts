'use client';

import { useEffect } from 'react';

import type { RestaurantDetailsFormValues } from '@/components/ops/restaurants/RestaurantDetailsForm';

type UseProfileGbpDraftOverridesInput = {
  previewValues: RestaurantDetailsFormValues;
  registerGbpDraftOverride?: (fieldKey: string, value: unknown | null) => void;
  clearGbpDraftOverrides?: (fieldKeys?: ReadonlyArray<string>) => void;
};

const PROFILE_GBP_DRAFT_OVERRIDE_KEYS = [
  'profile.name',
  'profile.businessDescription',
  'profile.contactPhone',
  'profile.address',
  'profile.googleMapUrl',
  'profile.googleReviewUrl',
] as const;

export function useProfileGbpDraftOverrides({
  previewValues,
  registerGbpDraftOverride,
  clearGbpDraftOverrides,
}: UseProfileGbpDraftOverridesInput) {
  useEffect(() => {
    if (!registerGbpDraftOverride) return;
    registerGbpDraftOverride('profile.name', previewValues.name);
    registerGbpDraftOverride('profile.businessDescription', previewValues.businessDescription);
    registerGbpDraftOverride('profile.contactPhone', previewValues.contactPhone);
    registerGbpDraftOverride('profile.address', previewValues.address);
    registerGbpDraftOverride('profile.googleMapUrl', previewValues.googleMapUrl);
    registerGbpDraftOverride('profile.googleReviewUrl', previewValues.googleReviewUrl);
    return () => {
      clearGbpDraftOverrides?.(PROFILE_GBP_DRAFT_OVERRIDE_KEYS);
    };
  }, [
    clearGbpDraftOverrides,
    previewValues.address,
    previewValues.businessDescription,
    previewValues.contactPhone,
    previewValues.googleMapUrl,
    previewValues.googleReviewUrl,
    previewValues.name,
    registerGbpDraftOverride,
  ]);
}
