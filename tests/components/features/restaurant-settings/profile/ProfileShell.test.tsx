import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProfileShell } from '@/components/features/restaurant-settings/profile/ProfileShell';

describe('ProfileShell', () => {
  it('@smoke @a11y frames profile content with the sections nav landmark', () => {
    render(
      <ProfileShell
        railItems={[{ label: 'Brand and identity', onSelect: vi.fn(), isActive: true }]}
      >
        <p>Profile body</p>
      </ProfileShell>,
    );

    expect(screen.getByRole('region', { name: 'Profile sections' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Profile sections' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Brand and identity/ })).toBeInTheDocument();
    expect(screen.getByText('Profile body')).toBeInTheDocument();
  });

  it('@contract renders without a rail when no items are provided', () => {
    render(
      <ProfileShell>
        <p>Profile body</p>
      </ProfileShell>,
    );

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByText('Profile body')).toBeInTheDocument();
  });
});
