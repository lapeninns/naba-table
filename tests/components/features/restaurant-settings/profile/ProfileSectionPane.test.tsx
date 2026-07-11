import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProfileSectionPane } from '@/components/features/restaurant-settings/profile/ProfileSectionPane';
import { PROFILE_SECTION_DEFINITIONS } from '@/components/features/restaurant-settings/profile/profileSections';

const brandSection = PROFILE_SECTION_DEFINITIONS[0];

function renderPane(over: Partial<Parameters<typeof ProfileSectionPane>[0]> = {}) {
  render(
    <ProfileSectionPane
      section={brandSection}
      isActive
      isDirty={false}
      isMissingRequired={false}
      {...over}
    >
      <p>Section body</p>
    </ProfileSectionPane>,
  );
}

describe('ProfileSectionPane', () => {
  it('@smoke renders the section title, audience, and body when active', () => {
    renderPane();

    expect(screen.getByText(brandSection.paneTitle)).toBeInTheDocument();
    expect(screen.getByText(brandSection.audience)).toBeInTheDocument();
    expect(screen.getByText('Section body')).toBeVisible();
  });

  it('@contract hides inactive panes without unmounting their forms', () => {
    renderPane({ isActive: false });

    expect(screen.getByText('Section body')).not.toBeVisible();
  });

  it('@contract badges dirty sections and missing-required sections', () => {
    renderPane({ isDirty: true });
    expect(screen.getByText('Unsaved')).toBeInTheDocument();

    renderPane({ isMissingRequired: true });
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});
