'use client';

import {
  AdvancedIdentitySubform,
  BrandIdentitySubform,
  ContactLocationSubform,
  ManagerNotificationsSubform,
  type RestaurantDetailsDraftValues,
  type RestaurantDetailsFormValues,
} from '@/components/ops/restaurants/RestaurantDetailsForm';

import { RestaurantBusinessContextSection } from '../RestaurantBusinessContextSection';
import { RestaurantLogoUploader } from '../RestaurantLogoUploader';
import { PROFILE_SECTION_FORMS, type ProfileDirtyKey } from '../restaurantProfileModel';

import type { ProfileSectionDefinition } from './profileSections';
import type { deriveProfileVerification } from '../google-business-profile/googleBusinessProfileVerification';
import type { ComponentProps } from 'react';

type ProfileSectionBodyProps = {
  section: ProfileSectionDefinition;
  restaurantId: string;
  restaurantName: string;
  logoUrl: string | null;
  updateMutation: ComponentProps<typeof RestaurantLogoUploader>['updateMutation'];
  isLoading: boolean;
  onLogoPreviewChange: (previewUrl: string | null | undefined) => void;
  initialValues: RestaurantDetailsFormValues;
  dirtyHandlers: Record<ProfileDirtyKey, (dirty: boolean) => void>;
  draftHandlers: Partial<
    Record<ProfileDirtyKey, (draft: RestaurantDetailsDraftValues, dirty: boolean) => void>
  >;
  onResetDraftChange: (key: ProfileDirtyKey, resetDraft: (() => void) | null) => void;
  gbpFieldVerifications: ReturnType<typeof deriveProfileVerification>['fields'];
};

export function ProfileSectionBody({
  section,
  restaurantId,
  restaurantName,
  logoUrl,
  updateMutation,
  isLoading,
  onLogoPreviewChange,
  initialValues,
  dirtyHandlers,
  draftHandlers,
  onResetDraftChange,
  gbpFieldVerifications,
}: ProfileSectionBodyProps) {
  if (section.id === 'brand') {
    return (
      <>
        <RestaurantLogoUploader
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          logoUrl={logoUrl}
          updateMutation={updateMutation}
          isLoading={isLoading}
          onPreviewChange={onLogoPreviewChange}
        />
        <BrandIdentitySubform
          restaurantId={restaurantId}
          initialValues={initialValues}
          formId={PROFILE_SECTION_FORMS.brand}
          actionPlacement="stickyBar"
          onDirtyChange={dirtyHandlers.brand}
          onDraftChange={draftHandlers.brand}
          onResetDraftChange={(resetDraft) => onResetDraftChange('brand', resetDraft)}
          gbpFieldVerifications={gbpFieldVerifications}
        />
      </>
    );
  }

  if (section.id === 'contact') {
    return (
      <ContactLocationSubform
        restaurantId={restaurantId}
        initialValues={initialValues}
        formId={PROFILE_SECTION_FORMS.contact}
        actionPlacement="stickyBar"
        onDirtyChange={dirtyHandlers.contact}
        onDraftChange={draftHandlers.contact}
        onResetDraftChange={(resetDraft) => onResetDraftChange('contact', resetDraft)}
        gbpFieldVerifications={gbpFieldVerifications}
      />
    );
  }

  if (section.id === 'advanced') {
    return (
      <AdvancedIdentitySubform
        restaurantId={restaurantId}
        initialValues={initialValues}
        formId={PROFILE_SECTION_FORMS.advanced}
        actionPlacement="stickyBar"
        onDirtyChange={dirtyHandlers.advanced}
        onDraftChange={draftHandlers.advanced}
        onResetDraftChange={(resetDraft) => onResetDraftChange('advanced', resetDraft)}
      />
    );
  }

  if (section.id === 'notifications') {
    return (
      <ManagerNotificationsSubform
        restaurantId={restaurantId}
        initialValues={initialValues}
        formId={PROFILE_SECTION_FORMS.notifications}
        actionPlacement="stickyBar"
        onDirtyChange={dirtyHandlers.notifications}
        onDraftChange={draftHandlers.notifications}
        onResetDraftChange={(resetDraft) => onResetDraftChange('notifications', resetDraft)}
      />
    );
  }

  if (section.id === 'discovery') {
    return (
      <RestaurantBusinessContextSection
        restaurantId={restaurantId}
        embedded
        onDirtyChange={dirtyHandlers.discovery}
      />
    );
  }

  return null;
}
