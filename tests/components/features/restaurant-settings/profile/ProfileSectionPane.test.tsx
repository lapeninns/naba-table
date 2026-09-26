import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProfileSectionPane } from '@/components/features/restaurant-settings/profile/ProfileSectionPane';
import { STAFF_COMMUNICATIONS_SECTION_DEFINITIONS } from '@/components/features/restaurant-settings/profile/profileSections';

const notifications = STAFF_COMMUNICATIONS_SECTION_DEFINITIONS[0]!;

function renderPane(over: Partial<Parameters<typeof ProfileSectionPane>[0]> = {}) {
  return render(
    <ProfileSectionPane section={notifications} isDirty={false} issueCount={0} {...over}>
      <p>Section body</p>
    </ProfileSectionPane>,
  );
}

describe('ProfileSectionPane', () => {
  it('@a11y names the region by its heading and keeps the stable anchor id', () => {
    renderPane();

    const region = screen.getByRole('region', { name: 'Manager alerts' });
    expect(region).toHaveAttribute('id', 'staff-communications-manager-alerts');
    expect(screen.getByRole('heading', { level: 2, name: 'Manager alerts' })).toBeVisible();
    expect(screen.getByText('Staff only')).toBeInTheDocument();
    expect(screen.getByText('Section body')).toBeVisible();
  });

  it('@contract marks edited sections, and issues take precedence', () => {
    const { unmount } = renderPane({ isDirty: true });
    expect(screen.getByText('Edited')).toBeInTheDocument();
    unmount();

    renderPane({ isDirty: true, issueCount: 2 });
    expect(screen.getByText('2 issues')).toBeInTheDocument();
    expect(screen.queryByText('Edited')).not.toBeInTheDocument();
  });
});
