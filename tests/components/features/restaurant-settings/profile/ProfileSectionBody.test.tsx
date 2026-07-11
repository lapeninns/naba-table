import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The subforms and logo uploader carry their own suites; stub them so this test
// pins the section-to-form routing contract only.
vi.mock('@/components/ops/restaurants/RestaurantDetailsForm', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    BrandIdentitySubform: (props: { formId: string }) => (
      <div data-testid="brand-subform" data-form-id={props.formId} />
    ),
    ContactLocationSubform: (props: { formId: string }) => (
      <div data-testid="contact-subform" data-form-id={props.formId} />
    ),
    AdvancedIdentitySubform: (props: { formId: string }) => (
      <div data-testid="advanced-subform" data-form-id={props.formId} />
    ),
    ManagerNotificationsSubform: (props: { formId: string }) => (
      <div data-testid="notifications-subform" data-form-id={props.formId} />
    ),
  };
});

vi.mock('@/components/features/restaurant-settings/RestaurantLogoUploader', () => ({
  RestaurantLogoUploader: () => <div data-testid="logo-uploader" />,
}));

import { ProfileSectionBody } from '@/components/features/restaurant-settings/profile/ProfileSectionBody';
import { PROFILE_SECTION_DEFINITIONS } from '@/components/features/restaurant-settings/profile/profileSections';

function renderBody(sectionId: string) {
  const section = PROFILE_SECTION_DEFINITIONS.find((entry) => entry.id === sectionId);
  if (!section) throw new Error(`missing section ${sectionId}`);
  render(
    <ProfileSectionBody
      section={section}
      restaurantId="rest-1"
      restaurantName="Old Crown Girton"
      logoUrl={null}
      updateMutation={{ isPending: false, mutateAsync: vi.fn() } as never}
      isLoading={false}
      onLogoPreviewChange={vi.fn()}
      initialValues={{} as never}
      dirtyHandlers={
        {
          brand: vi.fn(),
          contact: vi.fn(),
          advanced: vi.fn(),
          notifications: vi.fn(),
        } as never
      }
      draftHandlers={{}}
      onResetDraftChange={vi.fn()}
      gbpFieldVerifications={{} as never}
    />,
  );
}

describe('ProfileSectionBody', () => {
  it('@contract renders the logo uploader with the brand subform for the brand section', () => {
    renderBody('brand');

    expect(screen.getByTestId('logo-uploader')).toBeInTheDocument();
    expect(screen.getByTestId('brand-subform')).toBeInTheDocument();
  });

  it('@contract routes contact, advanced, and notifications sections to their subforms', () => {
    renderBody('contact');
    expect(screen.getByTestId('contact-subform')).toBeInTheDocument();

    renderBody('advanced');
    expect(screen.getByTestId('advanced-subform')).toBeInTheDocument();

    renderBody('notifications');
    expect(screen.getByTestId('notifications-subform')).toBeInTheDocument();
  });
});
