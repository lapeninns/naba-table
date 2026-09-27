import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsCard } from '@/components/features/restaurant-settings/shared/SettingsCard';
import { SettingsCardEmptyState } from '@/components/features/restaurant-settings/shared/SettingsCardEmptyState';

describe('SettingsCardEmptyState', () => {
  it('@contract renders the compact empty state so it never outranks the card title (RR10)', () => {
    const { container } = render(
      <SettingsCard title="Invitations">
        <SettingsCardEmptyState title="No invitations waiting" description="Invite a teammate." />
      </SettingsCard>,
    );

    expect(container.querySelector('[data-slot="ops-empty-state"]')).toHaveAttribute(
      'data-size',
      'compact',
    );
    expect(screen.getByRole('heading', { level: 3, name: 'No invitations waiting' })).toHaveClass(
      'text-sm',
      'font-medium',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Invitations' })).toHaveClass('text-base');
  });
});
