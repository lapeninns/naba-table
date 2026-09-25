import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProfileShell } from '@/components/features/restaurant-settings/profile/ProfileShell';

describe('ProfileShell', () => {
  it('@smoke @a11y states the page purpose and docks the section jump bar', () => {
    render(
      <ProfileShell
        railItems={[
          { label: 'Name and booking link', targetId: 'profile-identity', isActive: true },
        ]}
        status={<p>All changes saved</p>}
      >
        <p>Profile body</p>
      </ProfileShell>,
    );

    expect(
      screen.getByText(
        'What guests see when they book: your name, booking page link, contact details and location.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Sections on this page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Name and booking link' })).toHaveAttribute(
      'href',
      '#profile-identity',
    );
    expect(screen.getByText('Profile body')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('@contract renders without a jump bar when no items are provided', () => {
    render(
      <ProfileShell>
        <p>Profile body</p>
      </ProfileShell>,
    );

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByText('Profile body')).toBeInTheDocument();
  });
});
